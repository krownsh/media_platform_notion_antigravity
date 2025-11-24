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
  addAnnotationFailure
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
          post_comments (*),
          post_analysis (*),
          user_annotations (*)
        `)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;

    console.log('[Saga] Fetched posts from DB:', data);

    // Transform data to match frontend structure
    const formattedPosts = data.map(post => ({
      id: post.id,
      dbId: post.id, // Database ID
      platform: post.platform,
      author: post.author_name,
      authorHandle: post.author_id,
      avatar: post.author_avatar_url,
      content: post.content,
      postedAt: post.posted_at,
      originalUrl: post.original_url,
      createdAt: post.created_at,
      fullJson: post.full_json,

      // Transform media array
      images: post.post_media
        ?.filter(m => m.type === 'image')
        .sort((a, b) => a.order - b.order)
        .map(m => m.url) || [],

      media: post.post_media || [],

      // Transform comments
      comments: post.post_comments?.map(c => ({
        user: c.author_name,
        author: c.author_name,
        text: c.content,
        postedAt: c.commented_at,
        handle: c.raw_data?.handle || c.raw_data?.authorHandle || '',
        avatar: c.raw_data?.avatar || '',
        replies: c.raw_data?.replies || []
      })) || [],

      // Transform annotations (筆記)
      annotations: post.user_annotations?.filter(a => a.type === 'note') || [],

      // Transform analysis
      analysis: post.post_analysis?.[0] ? {
        summary: post.post_analysis[0].summary,
        tags: post.post_analysis[0].tags || [],
        topics: post.post_analysis[0].topics || [],
        sentiment: post.post_analysis[0].sentiment,
        insights: post.post_analysis[0].insights || []
      } : null
    }));

    console.log('[Saga] Formatted posts:', formattedPosts);

    yield put(fetchPostsSuccess(formattedPosts));
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

    console.log('[Saga] Received postData from API:', postData);

    // 2. Authenticate user
    const { data: { user } } = yield call(() => supabase.auth.getUser());

    let userId = user?.id;
    if (!userId) {
      // Attempt sign in with provided credentials
      console.log('[Saga] No user found, attempting sign in...');
      const { data: authData, error: authError } = yield call(() =>
        supabase.auth.signInWithPassword({
          email: 'bgkong1205@gmail.com',
          password: 'A123123a'
        })
      );

      if (authData?.user) {
        userId = authData.user.id;
        console.log('[Saga] ✅ Signed in successfully as:', authData.user.email);
      } else {
        console.warn('[Saga] ❌ Sign-in failed. Data will NOT be saved to DB.', authError);
      }
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
      fullJson: postData.full_json || postData.fullJson || null
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

  } catch (error) {
    console.error('[Saga] Error in handleFetchPost:', error);
    yield put(fetchPostFailure(error.message));
  }
}

// Worker Saga: Add annotation (筆記)
function* handleAddAnnotation(action) {
  try {
    const { postId, content, userId } = action.payload;

    console.log('[Saga] Adding annotation:', { postId, content, userId });

    // Call backend API
    const response = yield call(fetch, `http://localhost:3001/api/posts/${postId}/annotations`, {
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

// Watcher Saga
function* watchPosts() {
  yield takeLatest(addPostByUrl.type, handleFetchPost);
  yield takeLatest(fetchPosts.type, handleFetchPosts);
  yield takeLatest(addAnnotation.type, handleAddAnnotation);
}

export default function* rootSaga() {
  yield all([
    watchPosts(),
  ]);
}
