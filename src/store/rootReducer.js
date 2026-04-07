import { combineReducers } from '@reduxjs/toolkit';
import postsReducer from '../features/postsSlice';
import authReducer from '../features/authSlice';
import uiReducer from '../features/uiSlice';

const rootReducer = combineReducers({
  posts: postsReducer,
  auth: authReducer,
  ui: uiReducer,
});

export default rootReducer;
