import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    items: [], // List of posts
    loading: false,
    error: null,
    currentPost: null, // Currently viewed/processing post
};

const postsSlice = createSlice({
    name: 'posts',
    initialState,
    reducers: {
        fetchPostStart(state) {
            state.loading = true;
            state.error = null;
        },
        fetchPostSuccess(state, action) {
            state.loading = false;
            state.items.unshift(action.payload); // Add new post to top
            state.currentPost = action.payload;
        },
        fetchPostFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
        // Fetch all posts
        fetchPosts(state) {
            state.loading = true;
            state.error = null;
        },
        fetchPostsSuccess(state, action) {
            state.loading = false;
            state.items = action.payload;
        },
        fetchPostsFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
        // Action to trigger Saga
        addPostByUrl(state) {
            // Payload: { url: string }
            state.loading = true;
            state.error = null;
        },
        reorderPosts(state, action) {
            const { oldIndex, newIndex } = action.payload;
            const item = state.items.splice(oldIndex, 1)[0];
            state.items.splice(newIndex, 0, item);
        },
        // Annotation actions
        addAnnotation(state) {
            // This will trigger saga
            state.loading = true;
        },
        addAnnotationSuccess(state, action) {
            // action.payload: { postId, annotation }
            const { postId, annotation } = action.payload;
            const post = state.items.find(p => p.id === postId || p.dbId === postId);
            if (post) {
                if (!post.annotations) post.annotations = [];
                post.annotations.unshift(annotation);
            }
            // Also update currentPost if it matches
            if (state.currentPost && (state.currentPost.id === postId || state.currentPost.dbId === postId)) {
                if (!state.currentPost.annotations) state.currentPost.annotations = [];
                state.currentPost.annotations.unshift(annotation);
            }
            state.loading = false;
        },
        addAnnotationFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const {
    fetchPostStart,
    fetchPostSuccess,
    fetchPostFailure,
    fetchPosts,
    fetchPostsSuccess,
    fetchPostsFailure,
    addPostByUrl,
    reorderPosts,
    addAnnotation,
    addAnnotationSuccess,
    addAnnotationFailure
} = postsSlice.actions;
export default postsSlice.reducer;
