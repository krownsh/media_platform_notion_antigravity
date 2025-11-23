import { all, takeLatest, call, put } from 'redux-saga/effects';
import {
  addPostByUrl,
  fetchPostSuccess,
  fetchPostFailure,
  fetchPosts,
  fetchPostsSuccess,
  fetchPostsFailure
} from '../features/postsSlice';
import { supabase } from '../api/supabaseClient';

// Worker Saga: Fetch all posts
function* handleFetchPosts() {
  try {
    const { data, error } = yield call(() =>
      supabase
        .from('posts')
        .select(`
          *,
          post_media (*),
          post_analysis (*)
        `)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;

    // Transform data to match frontend structure
    const formattedPosts = data.map(post => ({
      id: post.id,
      platform: post.platform,
      author: post.author_name,
      authorHandle: post.author_id,
      avatar: post.author_avatar_url,
      content: post.content,
      postedAt: post.posted_at,
      originalUrl: post.original_url,
      createdAt: post.created_at,

      // Transform media array
      images: post.post_media
        ?.filter(m => m.type === 'image')
        .sort((a, b) => a.order - b.order)
        .map(m => m.url) || [],

      media: post.post_media || [],

      // Transform analysis
      analysis: post.post_analysis?.[0] ? {
        summary: post.post_analysis[0].summary,
        tags: post.post_analysis[0].tags || [],
        topics: post.post_analysis[0].topics || [],
        sentiment: post.post_analysis[0].sentiment,
        insights: post.post_analysis[0].insights || []
      } : null,

      // Comments will be loaded separately if needed
      comments: []
    }));

    yield put(fetchPostsSuccess(formattedPosts));
  } catch (error) {
    console.error('Fetch Posts Error:', error);
    yield put(fetchPostsFailure(error.message));
  }
}

// Worker Saga: Handle adding a post by URL
function* handleFetchPost(action) {
  try {
    const { url } = action.payload;

    // 1. Call Backend API (Orchestrator) to get raw data
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

    // 2. Save to Supabase
    const { data: { user } } = yield call(() => supabase.auth.getUser());

    let userId = user?.id;
    if (!userId) {
      // Attempt sign in with provided credentials
      console.log('Attempting to sign in with fallback credentials...');
      const { data: authData, error: authError } = yield call(() =>
        supabase.auth.signInWithPassword({
          email: 'bgkong1205@gmail.com',
          password: 'A123123a'
        })
      );

      if (authData?.user) {
        userId = authData.user.id;
        console.log('✅ Signed in successfully as:', authData.user.email);
      } else {
        console.warn('❌ Sign-in failed. Data will NOT be saved to DB.', authError);
      }
    }

    if (userId) {
      // Insert Post
      const { data: savedPost, error: postError } = yield call(() =>
        supabase.from('posts').insert({
          user_id: userId,
          platform: postData.platform || 'unknown',
          original_url: url,
          platform_post_id: postData.platformId || postData.id,
          author_name: postData.author?.name,
          author_id: postData.author?.id,
          author_avatar_url: postData.author?.avatar,
          content: postData.text || postData.content,
          posted_at: postData.timestamp ? new Date(postData.timestamp) : new Date(),
        }).select().single()
      );

      if (postError) throw postError;

      const postId = savedPost.id;

      // Insert Media
      if (postData.media && postData.media.length > 0) {
        const mediaRecords = postData.media.map((m, index) => ({
          post_id: postId,
          user_id: userId,
          type: m.type || 'image',
          url: m.url,
          thumbnail_url: m.thumbnail,
          order: index,
          meta_data: m.meta || {}
        }));
        yield call(() => supabase.from('post_media').insert(mediaRecords));
      }

      // Insert Analysis
      if (postData.analysis) {
        yield call(() => supabase.from('post_analysis').insert({
          post_id: postId,
          user_id: userId,
          summary: postData.analysis.summary,
          tags: postData.analysis.tags,
          topics: postData.analysis.topics,
          sentiment: postData.analysis.sentiment,
          insights: postData.analysis.insights
        }));
      }

      // Return the saved post with ID and associated data
      const finalPost = {
        ...savedPost,
        media: postData.media,
        analysis: postData.analysis
      };
      yield put(fetchPostSuccess(finalPost));
    } else {
      // Fallback if no DB save
      const finalPost = {
        ...postData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      yield put(fetchPostSuccess(finalPost));
    }

  } catch (error) {
    console.error('Saga Error:', error);
    yield put(fetchPostFailure(error.message));
  }
}

// Watcher Saga
function* watchPosts() {
  yield takeLatest(addPostByUrl.type, handleFetchPost);
  yield takeLatest(fetchPosts.type, handleFetchPosts);
}

export default function* rootSaga() {
  yield all([
    watchPosts(),
  ]);
}
