import { combineReducers } from '@reduxjs/toolkit';
import postsReducer from '../features/postsSlice';
import authReducer from '../features/authSlice';
import uiReducer from '../features/uiSlice';
import reviewReducer from '../features/reviewSlice';

const rootReducer = combineReducers({
  posts: postsReducer,
  auth: authReducer,
  ui: uiReducer,
  review: reviewReducer,
});

export default rootReducer;
