import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
    name: 'ui',
    initialState: {
        notifications: [],
    },
    reducers: {
        addNotification: (state, action) => {
            // action.payload: { message: string, type: 'error' | 'success' | 'info', id: string }
            state.notifications.push({
                id: Date.now().toString(),
                type: 'info',
                ...action.payload,
            });
        },
        removeNotification: (state, action) => {
            state.notifications = state.notifications.filter(n => n.id !== action.payload);
        },
    },
});

export const { addNotification, removeNotification } = uiSlice.actions;
export default uiSlice.reducer;
