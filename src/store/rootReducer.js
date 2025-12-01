import { combineReducers } from '@reduxjs/toolkit';
import postsReducer from '../features/postsSlice';
import authReducer from '../features/authSlice';

const rootReducer = combineReducers({
  posts: postsReducer,
  auth: authReducer,
  // collections: collectionsReducer,
});

export default rootReducer;
