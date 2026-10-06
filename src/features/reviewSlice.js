import { createSlice } from '@reduxjs/toolkit';

const initialState = { packets: [], activePacketId: null, loading: false, actionPending: false, error: null };

const reviewSlice = createSlice({
    name: 'review',
    initialState,
    reducers: {
        fetchReviewPackets(state) { state.loading = true; state.error = null; },
        fetchReviewPacketsSuccess(state, action) {
            state.loading = false;
            state.packets = action.payload || [];
            if (!state.packets.some(packet => packet.id === state.activePacketId)) {
                state.activePacketId = state.packets[0]?.id || null;
            }
        },
        fetchReviewPacketsFailure(state, action) { state.loading = false; state.error = action.payload; },
        prepareReviewCandidates(state) { state.actionPending = true; state.error = null; },
        reviewCandidatesPrepared(state, action) {
            state.actionPending = false;
            const packetId = action.payload?.packet?.id || action.payload?.id || null;
            if (packetId) state.activePacketId = packetId;
        },
        selectReviewPacket(state, action) { state.activePacketId = action.payload || null; },
        deferReviewPacket(state) { state.actionPending = true; state.error = null; },
        resumeReviewPacket(state) { state.actionPending = true; state.error = null; },
        decideReviewProposal(state) { state.actionPending = true; state.error = null; },
        reviewPacketUpdated(state, action) {
            state.actionPending = false;
            const packet = action.payload;
            const index = state.packets.findIndex(item => item.id === packet.id);
            if (index >= 0) state.packets[index] = packet;
            else state.packets.unshift(packet);
            state.activePacketId = packet.id;
        },
        reviewActionFailure(state, action) { state.actionPending = false; state.error = action.payload; }
    }
});

export const {
    fetchReviewPackets, fetchReviewPacketsSuccess, fetchReviewPacketsFailure,
    prepareReviewCandidates, reviewCandidatesPrepared, selectReviewPacket,
    deferReviewPacket, resumeReviewPacket, decideReviewProposal,
    reviewPacketUpdated, reviewActionFailure
} = reviewSlice.actions;
export default reviewSlice.reducer;
