import { all, takeLatest, call, put } from 'redux-saga/effects';
import { addPostByUrl, fetchPostSuccess, fetchPostFailure } from '../features/postsSlice';
import { aiService } from '../services/aiService';
import { supabase } from '../api/supabaseClient';

// Worker Saga: Handle adding a post by URL
function* handleFetchPost(action) {
  try {
    const { url } = action.payload;

    // 1. Call Backend API (Orchestrator) to get raw data
    // Note: In a real app, this would call the Express server we built
    const response = yield call(fetch, 'http://localhost:3001/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch post data from backend');
    }

    const result = yield response.json();
    const postData = result.data;

    // 2. Analyze with AI
    const analysis = yield call([aiService, 'analyzePost'], postData);

    // 3. Save to Supabase
    // Get current user
    const { data: { user } } = yield call([supabase.auth, 'getUser']);

    if (!user) {
      // For dev/demo without auth, we might skip or throw
      // throw new Error('User not logged in');
      console.warn('User not logged in, skipping DB save for demo');
    } else {
      // Insert into 'posts' table
      const { data: savedPost, error: dbError } = yield call([supabase, 'from'], 'posts');
      // ... implementation of DB insert would go here
      // For now, we just return the combined object
    }

    const finalPost = {
      ...postData,
      analysis,
      id: crypto.randomUUID(), // Temp ID
      createdAt: new Date().toISOString(),
    };

    yield put(fetchPostSuccess(finalPost));

  } catch (error) {
    console.error('Saga Error:', error);
    yield put(fetchPostFailure(error.message));
  }
}

// Watcher Saga
function* watchPosts() {
  yield takeLatest(addPostByUrl.type, handleFetchPost);
}

export default function* rootSaga() {
  yield all([
    watchPosts(),
  ]);
}
