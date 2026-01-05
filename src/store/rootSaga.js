import { all, takeLatest, call, put } from 'redux-saga/effects';
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
  deletePost,
  deletePostSuccess,
  deletePostFailure,
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
  updateCollectionNameSuccess
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
  try {
    const { url } = action.payload;

    // 1. Call Backend API (Orchestrator) to get raw data
    console.log('[Saga] Fetching post from backend:', url);
    const response = yield call(fetch, `${API_BASE_URL}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch post data from backend');
    }

    const result = yield response.json();
    const postData = result.data;

    console.log('[Saga] Received postData from API:', postData);

    // 2. Authenticate user
    const { data: { user } } = yield call(() => supabase.auth.getUser());

    let userId = user?.id;
    if (!userId) {
      console.warn('[Saga] No user found. Data will NOT be saved to DB.');
    }

    // 3. Transform data for frontend (immediate display)
    const transformedPost = {
      id: crypto.randomUUID(),
      platform: postData.platform || 'threads',
      author: postData.author || 'Unknown',
      authorHandle: postData.authorHandle || 'unknown',
      avatar: postData.avatar,
      content: postData.content,
      postedAt: postData.postedAt,
      originalUrl: postData.originalUrl || url,
      createdAt: new Date().toISOString(),
      images: postData.images || [],
      comments: postData.comments || [],
      analysis: postData.analysis || null,
      fullJson: postData.full_json || postData.fullJson || null,
      collectionId: null
    };

    console.log('[Saga] Transformed post for display:', transformedPost);

    // 4. Save to Supabase (if authenticated)
    if (userId) {
      try {
        console.log('[Saga] Saving to database...');

        // 4.1 Insert Post
        const { data: savedPost, error: postError } = yield call(() =>
          supabase.from('posts').insert({
            user_id: userId,
            platform: transformedPost.platform,
            original_url: transformedPost.originalUrl,
            platform_post_id: postData.id || null,
            author_name: transformedPost.author,
            author_id: transformedPost.authorHandle,
            author_avatar_url: transformedPost.avatar,
            content: transformedPost.content,
            posted_at: transformedPost.postedAt ? new Date(transformedPost.postedAt) : new Date(),
            full_json: transformedPost.fullJson || null
          }).select().single()
        );

        if (postError) {
          console.error('[Saga] Failed to save post:', postError);
          throw postError;
        }

        console.log('[Saga] ✅ Post saved:', savedPost.id);
        const postId = savedPost.id;
        transformedPost.dbId = postId;

        // 4.2 Insert Media (Images)
        if (transformedPost.images && transformedPost.images.length > 0) {
          console.log(`[Saga] Saving ${transformedPost.images.length} images...`);
          const mediaRecords = transformedPost.images.map((imgUrl, index) => ({
            post_id: postId,
            user_id: userId,
            type: 'image',
            url: imgUrl,
            order: index,
            meta_data: {}
          }));

          const { error: mediaError } = yield call(() =>
            supabase.from('post_media').insert(mediaRecords)
          );

          if (mediaError) {
            console.error('[Saga] Failed to save media:', mediaError);
          } else {
            console.log(`[Saga] ✅ Saved ${mediaRecords.length} media items`);
          }
        }

        // 4.3 Insert Comments
        if (transformedPost.comments && transformedPost.comments.length > 0) {
          console.log(`[Saga] Saving ${transformedPost.comments.length} comments...`);
          const commentRecords = transformedPost.comments.map(comment => ({
            post_id: postId,
            user_id: userId,
            author_name: comment.user || comment.author,
            content: comment.text,
            commented_at: comment.postedAt ? new Date(comment.postedAt) : new Date(),
            raw_data: comment // Store the entire comment object as JSONB
          }));

          const { error: commentsError } = yield call(() =>
            supabase.from('post_comments').insert(commentRecords)
          );

          if (commentsError) {
            console.error('[Saga] Failed to save comments:', commentsError);
          } else {
            console.log(`[Saga] ✅ Saved ${commentRecords.length} comments`);
          }
        }

        // 4.4 Insert Analysis (if exists)
        if (transformedPost.analysis && transformedPost.analysis.summary) {
          console.log('[Saga] Saving AI analysis...');
          const { error: analysisError } = yield call(() =>
            supabase.from('post_analysis').insert({
              post_id: postId,
              user_id: userId,
              summary: transformedPost.analysis.summary,
              tags: transformedPost.analysis.tags || [],
              topics: transformedPost.analysis.topics || [],
              sentiment: transformedPost.analysis.sentiment || null,
              insights: transformedPost.analysis.insights || []
            })
          );

          if (analysisError) {
            console.error('[Saga] Failed to save analysis:', analysisError);
          } else {
            console.log('[Saga] ✅ Saved AI analysis');
          }
        }

        console.log('[Saga] ✅ All data saved successfully!');

      } catch (dbError) {
        console.error('[Saga] Database save error:', dbError);
        // Continue to display data even if DB save fails
      }
    } else {
      console.warn('[Saga] No user ID - data not saved to database');
    }

    // 5. Return the post to Redux store for immediate display
    yield put(fetchPostSuccess(transformedPost));
    yield put(addNotification({ message: '貼文已成功擷取', type: 'success' }));

  } catch (error) {
    console.error('[Saga] Error in handleFetchPost:', error);
    yield put(addNotification({
      message: `擷取失敗: ${error.message || '請確認網址是否正確或稍後再試'}`,
      type: 'error'
    }));
    yield put(fetchPostFailure(error.message));
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

// Worker Saga: Delete post
function* handleDeletePost(action) {
  try {
    const postId = action.payload;
    console.log('[Saga] Deleting post:', postId);

    // 1. Delete from Supabase (if it has a DB ID)
    // We try to delete by id (which is the UUID in Supabase)
    // If the post only exists in Redux (not saved yet), this step might fail or do nothing, which is fine.

    // Check if it's a valid UUID (simple check)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);

    if (isUuid) {
      const { error } = yield call(() =>
        supabase.from('posts').delete().eq('id', postId)
      );

      if (error) {
        console.error('[Saga] Failed to delete post from DB:', error);
        // We might still want to remove it from UI even if DB delete fails?
        // For now, let's assume if DB delete fails, we shouldn't remove it from UI.
        throw error;
      } else {
        console.log('[Saga] ✅ Post deleted from DB');
      }
    } else {
      console.log('[Saga] Post ID is not a UUID, skipping DB delete (local only?)');
    }

    // 2. Update Redux store
    yield put(deletePostSuccess(postId));

  } catch (error) {
    console.error('[Saga] Error deleting post:', error);
    yield put(deletePostFailure(error.message));
  }
}

// Worker Saga: Create Collection
function* handleCreateCollection(action) {
  try {
    const { name } = action.payload;
    const { data: { user } } = yield call(() => supabase.auth.getUser());

    if (!user) throw new Error('User not authenticated');

    const { data, error } = yield call(() =>
      supabase.from('collections').insert({
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
      supabase.from('posts')
        .update({ collection_id: null })
        .eq('collection_id', collectionId)
    );

    if (updateError) throw updateError;

    // Then delete the collection
    const { error: deleteError } = yield call(() =>
      supabase.from('collections').delete().eq('id', collectionId)
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
      supabase.from('posts')
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
      supabase.from('collections')
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
  yield takeLatest(addPostByUrl.type, handleFetchPost);
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
