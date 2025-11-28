import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    items: [], // List of posts (uncategorized or all, depending on view)
    collections: [], // List of collections (folders)
    loading: false,
    analyzing: false, // Specific loading state for AI analysis/creation
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
            state.analyzing = false; // Reset analyzing on success
            state.items.unshift(action.payload); // Add new post to top
            state.currentPost = action.payload;
        },
        fetchPostFailure(state, action) {
            state.loading = false;
            state.analyzing = false; // Reset analyzing on failure
            state.error = action.payload;
        },
        // Fetch all posts and collections
        fetchPosts(state) {
            state.loading = true;
            state.error = null;
        },
        fetchPostsSuccess(state, action) {
            state.loading = false;
            state.items = action.payload.posts;
            state.collections = action.payload.collections;
        },
        fetchPostsFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
        // Action to trigger Saga
        addPostByUrl(state) {
            // Payload: { url: string }
            state.analyzing = true; // Set analyzing true for new post creation
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
        // Delete post actions
        deletePost(state) {
            state.loading = true;
        },
        deletePostSuccess(state, action) {
            // action.payload: postId
            state.loading = false;
            state.items = state.items.filter(item => item.id !== action.payload && item.dbId !== action.payload);
            if (state.currentPost && (state.currentPost.id === action.payload || state.currentPost.dbId === action.payload)) {
                state.currentPost = null;
            }
        },
        deletePostFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
        // Collection Actions
        createCollection(state) {
            // Don't set loading to true to avoid full page skeleton flicker
        },
        createCollectionSuccess(state, action) {
            state.loading = false;
            state.collections.unshift(action.payload);
        },
        createCollectionFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
        deleteCollection(state) {
            state.loading = true;
        },
        deleteCollectionSuccess(state, action) {
            state.loading = false;
            state.collections = state.collections.filter(c => c.id !== action.payload);
            // Move posts from deleted collection back to main list (handled by backend usually, but UI update needed)
            // Ideally, fetchPosts should be called again or we optimistically update
        },
        deleteCollectionFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        },
        movePostToCollection(state) {
            // Trigger Saga
        },
        movePostToCollectionSuccess(state, action) {
            const { postId, collectionId } = action.payload;
            // Update the post in items
            const postIndex = state.items.findIndex(p => p.id === postId);
            if (postIndex !== -1) {
                state.items[postIndex].collectionId = collectionId;
            }
        },
        movePostToCollectionFailure(state, action) {
            state.error = action.payload;
        },
        updateCollectionName(state) {
            // Trigger Saga
        },
        updateCollectionNameSuccess(state, action) {
            const { collectionId, name } = action.payload;
            const collection = state.collections.find(c => c.id === collectionId);
            if (collection) {
                collection.name = name;
            }
        }
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
} = postsSlice.actions;
export default postsSlice.reducer;
