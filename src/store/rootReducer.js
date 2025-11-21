import { combineReducers } from '@reduxjs/toolkit';
import postsReducer from '../features/postsSlice';

const rootReducer = combineReducers({
  posts: postsReducer,
  // collections: collectionsReducer,
});

export default rootReducer;
