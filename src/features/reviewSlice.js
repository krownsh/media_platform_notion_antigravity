import { createSlice } from '@reduxjs/toolkit';

const initialState = { packets: [], loading: false, actionPending: false, error: null };

const reviewSlice = createSlice({
    name: 'review',
    initialState,
    reducers: {
        fetchReviewPackets(state) { state.loading = true; state.error = null; },
        fetchReviewPacketsSuccess(state, action) { state.loading = false; state.packets = action.payload || []; },
        fetchReviewPacketsFailure(state, action) { state.loading = false; state.error = action.payload; },
        deferReviewPacket(state) { state.actionPending = true; state.error = null; },
        resumeReviewPacket(state) { state.actionPending = true; state.error = null; },
        decideReviewProposal(state) { state.actionPending = true; state.error = null; },
        reviewPacketUpdated(state, action) {
            state.actionPending = false;
            const packet = action.payload;
            const index = state.packets.findIndex(item => item.id === packet.id);
            if (index >= 0) state.packets[index] = packet;
            else state.packets.unshift(packet);
        },
        reviewActionFailure(state, action) { state.actionPending = false; state.error = action.payload; }
    }
});

export const {
    fetchReviewPackets, fetchReviewPacketsSuccess, fetchReviewPacketsFailure,
    deferReviewPacket, resumeReviewPacket, decideReviewProposal,
    reviewPacketUpdated, reviewActionFailure
} = reviewSlice.actions;
export default reviewSlice.reducer;
