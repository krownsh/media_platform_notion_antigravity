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
    },
});

export const { fetchPostStart, fetchPostSuccess, fetchPostFailure, fetchPosts, fetchPostsSuccess, fetchPostsFailure, addPostByUrl, reorderPosts } = postsSlice.actions;
export default postsSlice.reducer;
