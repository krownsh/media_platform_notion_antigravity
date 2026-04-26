import { all, takeLatest, takeEvery, call, put } from 'redux-saga/effects';
import {
  addPostByUrl,
  fetchPostSuccess,
  fetchPostFailure,
  fetchPosts,
  fetchPostsSuccess,
  fetchPostsFailure,
  addAnnotation,
  addAnnotationSuccess,
  addAnnotationFailure,
  deletePostFailure,
  addTask,
  updateTaskStatus,
  removeTask,
  createCollection,
  createCollectionSuccess,
  createCollectionFailure,
  deleteCollection,
  deleteCollectionSuccess,
  deleteCollectionFailure,
  movePostToCollection,
  movePostToCollectionSuccess,
  movePostToCollectionFailure,
  updateCollectionName,
  updateCollectionNameSuccess,
  deletePost,
  deletePostSuccess
} from '../features/postsSlice';
import { addNotification } from '../features/uiSlice';
import { supabase } from '../api/supabaseClient';
import { API_BASE_URL } from '../api/config';


// Worker Saga: Fetch all posts AND collections
function* handleFetchPosts() {
  try {
    // 1. Ensure user is authenticated
    const { data: { session } } = yield call(() => supabase.auth.getSession());
    const user = session?.user;

    if (!user) {
      console.warn('[Saga] No user found during fetchPosts. User should be authenticated by ProtectedRoute.');
      // Return empty if no user, or handle as error
      yield put(fetchPostsSuccess({ posts: [], collections: [] }));
      return;
    }

    // 2. Call Backend API
    console.log('[Saga] Fetching posts from backend...');
    const response = yield call(fetch, `${API_BASE_URL}/api/posts`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch posts from backend');
    }

    const data = yield response.json();
    console.log('[Saga] Fetched posts:', data.posts?.length);

    yield put(fetchPostsSuccess({
      posts: data.posts || [],
      collections: data.collections || []
    }));
  } catch (error) {
    console.error('[Saga] Fetch Posts Error:', error);
    yield put(fetchPostsFailure(error.message));
  }
}

// Worker Saga: Handle adding a post by URL
function* handleFetchPost(action) {
  const { url, taskId } = action.payload;
  try {
    // 1. Initial State: Starting crawl
    yield put(updateTaskStatus({ taskId, status: 'crawling' }));

    // 2. Get current authenticated user
    const { data: { user } } = yield call(() => supabase.auth.getUser());
    const userId = user?.id;

    // 3. Call Backend API (Orchestrator) to get data AND save to DB
    console.log('[Saga] Requesting backend to process & save:', url, 'for user:', userId);
    const response = yield call(fetch, `${API_BASE_URL}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, userId }),
    });

    if (!response.ok) {
      const errorData = yield response.json();
      throw new Error(errorData.error || 'Failed to fetch post data from backend');
    }

    const result = yield response.json();
    const postData = result.data;

    console.log('[Saga] Received processed post from backend:', postData.dbId);
    yield put(updateTaskStatus({ taskId, status: 'analyzing' }));

    // 4. Transform data for frontend display
    const transformedPost = {
      id: crypto.randomUUID(),
      dbId: postData.dbId, // Backend provided ID
      platform: postData.platform || 'threads',
      author: postData.author || 'Unknown',
      authorHandle: postData.authorHandle || 'unknown',
      avatar: postData.avatar,
      content: postData.content,
      postedAt: postData.postedAt || postData.posted_at,
      originalUrl: postData.originalUrl || url,
      createdAt: new Date().toISOString(),
      images: postData.images || [],
      comments: postData.comments || [],
      analysis: postData.analysis || null,
      fullJson: postData.full_json || postData.fullJson || null,
      collectionId: null
    };

    console.log('[Saga] Final transformed post for UI:', transformedPost);

    // 5. Update Redux store for immediate display
    yield put(fetchPostSuccess(transformedPost));
    yield put(addNotification({ message: '貼文已成功擷取並存入資料庫', type: 'success' }));
    yield put(removeTask(taskId));

  } catch (error) {
    console.error('[Saga] Error in handleFetchPost:', error);
    yield put(addNotification({
      message: `擷取失敗: ${error.message || '請確認網址是否正確或稍後再試'}`,
      type: 'error'
    }));
    yield put(fetchPostFailure(error.message));
    yield put(updateTaskStatus({ taskId, status: 'failed' }));
  }
}

// Worker Saga: Add annotation (筆記)
function* handleAddAnnotation(action) {
  try {
    const { postId, content, userId } = action.payload;

    console.log('[Saga] Adding annotation:', { postId, content, userId });

    // Call backend API
    const response = yield call(fetch, `${API_BASE_URL}/api/posts/${postId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to add annotation');
    }

    const result = yield response.json();
    console.log('[Saga] Annotation added:', result.annotation);

    // Update Redux store
    yield put(addAnnotationSuccess({
      postId,
      annotation: result.annotation
    }));

  } catch (error) {
    console.error('[Saga] Error adding annotation:', error);
    yield put(addAnnotationFailure(error.message));
  }
}

// Worker Saga: Delete post (fire-and-forget backend)
function* handleDeletePost(action) {
  const postId = action.payload;
  console.log('[Saga] Optimistic delete, background DB cleanup for:', postId);

  // UI is already updated instantly by the optimistic reducer in postsSlice.
  // Here we only handle the background DB deletion silently.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
  if (isUuid) {
    try {
      const { error } = yield call(() =>
        supabase.from('collection_posts').delete().eq('id', postId)
      );
      if (error) {
        console.error('[Saga] Background DB delete failed (silent):', error);
      } else {
        console.log('[Saga] ✅ Post deleted from DB');
      }
    } catch (err) {
      console.error('[Saga] Background DB delete exception (silent):', err);
    }
  }
}

// Worker Saga: Create Collection
function* handleCreateCollection(action) {
  try {
    const { name } = action.payload;
    const { data: { user } } = yield call(() => supabase.auth.getUser());

    if (!user) throw new Error('User not authenticated');

    const { data, error } = yield call(() =>
      supabase.from('collection_collections').insert({
        name,
        user_id: user.id
      }).select().single()
    );

    if (error) throw error;

    yield put(createCollectionSuccess(data));
  } catch (error) {
    console.error('[Saga] Create Collection Error:', error);
    yield put(addNotification({ message: '建立資料夾失敗', type: 'error' }));
    yield put(createCollectionFailure(error.message));
  }
}

// Worker Saga: Delete Collection
function* handleDeleteCollection(action) {
  try {
    const collectionId = action.payload;

    // First, update all posts in this collection to have collection_id = null
    const { error: updateError } = yield call(() =>
      supabase.from('collection_posts')
        .update({ collection_id: null })
        .eq('collection_id', collectionId)
    );

    if (updateError) throw updateError;

    // Then delete the collection
    const { error: deleteError } = yield call(() =>
      supabase.from('collection_collections').delete().eq('id', collectionId)
    );

    if (deleteError) throw deleteError;

    yield put(deleteCollectionSuccess(collectionId));
    // Refresh posts to update their collectionId status in UI
    yield put(fetchPosts());
  } catch (error) {
    console.error('[Saga] Delete Collection Error:', error);
    yield put(deleteCollectionFailure(error.message));
  }
}

// Worker Saga: Move Post to Collection
function* handleMovePostToCollection(action) {
  try {
    const { postId, collectionId } = action.payload;

    const { error } = yield call(() =>
      supabase.from('collection_posts')
        .update({ collection_id: collectionId })
        .eq('id', postId)
    );

    if (error) throw error;

    yield put(movePostToCollectionSuccess({ postId, collectionId }));
  } catch (error) {
    console.error('[Saga] Move Post Error:', error);
    yield put(addNotification({ message: '移動貼文失敗', type: 'error' }));
    yield put(movePostToCollectionFailure(error.message));
  }
}

// Worker Saga: Update Collection Name
function* handleUpdateCollectionName(action) {
  try {
    const { collectionId, name } = action.payload;

    const { error } = yield call(() =>
      supabase.from('collection_collections')
        .update({ name })
        .eq('id', collectionId)
    );

    if (error) throw error;

    yield put(updateCollectionNameSuccess({ collectionId, name }));
  } catch (error) {
    console.error('[Saga] Update Collection Name Error:', error);
    // Handle error if needed
  }
}

// Watcher Saga
function* watchPosts() {
  yield takeEvery(addPostByUrl.type, handleFetchPost);
  yield takeLatest(fetchPosts.type, handleFetchPosts);
  yield takeLatest(addAnnotation.type, handleAddAnnotation);
  yield takeLatest(deletePost.type, handleDeletePost);
  yield takeLatest(createCollection.type, handleCreateCollection);
  yield takeLatest(deleteCollection.type, handleDeleteCollection);
  yield takeLatest(movePostToCollection.type, handleMovePostToCollection);
  yield takeLatest(updateCollectionName.type, handleUpdateCollectionName);
}

export default function* rootSaga() {
  yield all([
    watchPosts(),
  ]);
}
