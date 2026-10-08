import { all, takeLeading, takeLatest, takeEvery, call, put, delay } from 'redux-saga/effects';
import {
  addPostByUrl,
  monitorCapture,
  fetchCaptureHistory,
  fetchCaptureHistorySuccess,
  fetchCaptureHistoryFailure,
  fetchPostFailure,
  fetchPosts,
  fetchPostsSuccess,
  fetchPostsFailure,
  addAnnotation,
  addAnnotationSuccess,
  addAnnotationFailure,
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
  deletePost
} from '../features/postsSlice';
import { addNotification } from '../features/uiSlice';
import { supabase } from '../api/supabaseClient';
import { API_BASE_URL } from '../api/config';
import { getCaptureStatus, listCaptureHistory, submitUrlCapture } from '../api/captureApi';
import { createOwnerLibraryFolder, setOwnerLibraryFolder } from '../api/ownerLibraryApi';
import { listReviewPackets, prepareReviewCandidates as prepareReviewCandidatesApi, deferReviewPacket as deferPacketApi, resumeReviewPacket as resumePacketApi, decideReviewProposal as decideProposalApi } from '../api/reviewApi';
import {
    fetchReviewPackets, fetchReviewPacketsSuccess, fetchReviewPacketsFailure,
    prepareReviewCandidates, reviewCandidatesPrepared,
    deferReviewPacket, resumeReviewPacket, decideReviewProposal,
  reviewPacketUpdated, reviewActionFailure
} from '../features/reviewSlice';


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
    yield put(updateTaskStatus({ taskId, status: 'submitting' }));
    const capture = yield call(submitUrlCapture, url);
    yield put(updateTaskStatus({ taskId, status: 'accepted', captureId: capture.capture_id }));
    yield put(fetchCaptureHistory());
    yield put(monitorCapture({ captureId: capture.capture_id, taskId }));
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

function mapCaptureStatus(status) {
  if (status === 'accepted') return 'accepted';
  if (status === 'extracting') return 'extracting';
  return status;
}

function* handleMonitorCapture(action) {
  const { captureId, taskId } = action.payload;
  try {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const capture = yield call(getCaptureStatus, captureId);
      yield put(updateTaskStatus({ taskId, status: mapCaptureStatus(capture.status), captureId }));

      if (capture.status === 'finalized' || capture.status === 'degraded') {
        yield put(fetchPosts());
        yield put(fetchCaptureHistory());
        yield put(fetchReviewPackets());
        yield put(removeTask(taskId));
        yield put(addNotification({
          message: capture.input_type === 'image'
            ? '圖片來源已儲存；請在 Focus Mode 確認候選整理。'
            : '貼文來源已擷取；請在 Focus Mode 確認候選整理。',
          type: 'success'
        }));
        return;
      }
      if (capture.status === 'failed') {
        throw new Error(capture.error_message || '擷取任務失敗');
      }
      yield delay(2000);
    }
    throw new Error('擷取等待逾時，任務仍保留在伺服器佇列');
  } catch (error) {
    console.error('[Saga] Capture monitor failed:', error);
    yield put(updateTaskStatus({ taskId, status: 'failed', captureId }));
    yield put(fetchCaptureHistory());
    yield put(addNotification({ message: `擷取失敗: ${error.message}`, type: 'error' }));
  }
}

function* handleFetchCaptureHistory() {
  try {
    const captures = yield call(listCaptureHistory, 20);
    yield put(fetchCaptureHistorySuccess(captures));
  } catch (error) {
    // Capture history is observability, not a reason to interrupt normal
    // browsing when its endpoint is temporarily unavailable.
    console.error('[Saga] Capture history error:', error);
    yield put(fetchCaptureHistoryFailure(error.message));
  }
}

// Worker Saga: Add annotation (筆記)
function* handleAddAnnotation(action) {
  try {
    const { postId, content } = action.payload;

    const { data: { session } } = yield call(() => supabase.auth.getSession());
    if (!session?.access_token) {
      throw new Error('請先登入後再新增筆記');
    }

    console.log('[Saga] Adding annotation:', { postId, content });

    // Call backend API
    const response = yield call(fetch, `${API_BASE_URL}/api/posts/${postId}/annotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ content }),
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
      const { data: { user } } = yield call(() => supabase.auth.getUser());
      if (!user) throw new Error('User not authenticated');
      const { error } = yield call(() =>
        supabase.from('collection_posts').delete().eq('id', postId).eq('user_id', user.id)
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
    const collection = yield call(createOwnerLibraryFolder, name);
    yield put(createCollectionSuccess(collection));
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
    const { data: { user } } = yield call(() => supabase.auth.getUser());

    if (!user) throw new Error('User not authenticated');

    // First, update all posts in this collection to have collection_id = null
    const { error: updateError } = yield call(() =>
      supabase.from('collection_posts')
        .update({ collection_id: null })
        .eq('collection_id', collectionId)
        .eq('user_id', user.id)
    );

    if (updateError) throw updateError;

    // Then delete the collection
    const { error: deleteError } = yield call(() =>
      supabase.from('collection_collections').delete().eq('id', collectionId).eq('user_id', user.id)
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
    const result = yield call(setOwnerLibraryFolder, postId, collectionId);
    yield put(movePostToCollectionSuccess({ postId, collectionId: result.collection_id }));
    if (result.decision_path === 'review_promotion') {
      yield put(fetchReviewPackets());
    }
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
    const { data: { user } } = yield call(() => supabase.auth.getUser());

    if (!user) throw new Error('User not authenticated');

    const { error } = yield call(() =>
      supabase.from('collection_collections')
        .update({ name })
        .eq('id', collectionId)
        .eq('user_id', user.id)
    );

    if (error) throw error;

    yield put(updateCollectionNameSuccess({ collectionId, name }));
  } catch (error) {
    console.error('[Saga] Update Collection Name Error:', error);
    // Handle error if needed
  }
}

function* handleFetchReviewPackets() {
  try {
    yield put(fetchReviewPacketsSuccess(yield call(listReviewPackets)));
  } catch (error) {
    yield put(fetchReviewPacketsFailure(error.message));
  }
}

function* handlePrepareReviewCandidates(action) {
  try {
    const { sourceRevisionId, allowPartial = false } = action.payload;
    const review = yield call(prepareReviewCandidatesApi, sourceRevisionId, { allowPartial });
    yield put(reviewCandidatesPrepared(review));
    yield put(fetchReviewPackets());
    yield put(addNotification({
      message: '候選整理已建立；請在 Focus Mode 逐項確認。',
      type: 'success'
    }));
  } catch (error) {
    yield put(reviewActionFailure(error.message));
  }
}

function* handleDeferReviewPacket(action) {
  try {
    const { packetId, expectedVersion, reason } = action.payload;
    yield put(reviewPacketUpdated(yield call(deferPacketApi, packetId, expectedVersion, reason)));
  } catch (error) { yield put(reviewActionFailure(error.message)); }
}

function* handleResumeReviewPacket(action) {
  try {
    const { packetId, expectedVersion } = action.payload;
    yield put(reviewPacketUpdated(yield call(resumePacketApi, packetId, expectedVersion)));
  } catch (error) { yield put(reviewActionFailure(error.message)); }
}

function* handleDecideReviewProposal(action) {
  try {
    const { packetId, proposalId, decision, expectedVersion, editedPayload } = action.payload;
    yield put(reviewPacketUpdated(yield call(decideProposalApi, packetId, proposalId, decision, expectedVersion, editedPayload)));
  } catch (error) { yield put(reviewActionFailure(error.message)); }
}

// Watcher Saga
function* watchPosts() {
  yield takeEvery(addPostByUrl.type, handleFetchPost);
  yield takeEvery(monitorCapture.type, handleMonitorCapture);
  // Ignore overlapping reads. takeLatest cancels the saga task but cannot
  // cancel a browser fetch that has already reached /api/posts.
  yield takeLeading(fetchPosts.type, handleFetchPosts);
  yield takeLatest(fetchCaptureHistory.type, handleFetchCaptureHistory);
  yield takeLatest(addAnnotation.type, handleAddAnnotation);
  yield takeLatest(deletePost.type, handleDeletePost);
  yield takeLatest(createCollection.type, handleCreateCollection);
  yield takeLatest(deleteCollection.type, handleDeleteCollection);
  yield takeLatest(movePostToCollection.type, handleMovePostToCollection);
  yield takeLatest(updateCollectionName.type, handleUpdateCollectionName);
  yield takeLatest(fetchReviewPackets.type, handleFetchReviewPackets);
  yield takeLeading(prepareReviewCandidates.type, handlePrepareReviewCandidates);
  yield takeLeading(deferReviewPacket.type, handleDeferReviewPacket);
  yield takeLeading(resumeReviewPacket.type, handleResumeReviewPacket);
  yield takeLeading(decideReviewProposal.type, handleDecideReviewProposal);
}

export default function* rootSaga() {
  yield all([
    watchPosts(),
  ]);
}
