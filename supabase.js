// Supabase Configuration
const SUPABASE_URL = 'https://zhkasyvmkcraaallsacn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInRlZiOiJzdXBhYmFzZSIsInJlZiI6Inpoa2FzeXZta2NyYWFhbGxzYWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjkxMTcsImV4cCI6MjA3NjgwNTExN30.RqzYkSQjS2sN8yQteyEBQnZurVRxkAVicO6sQPh-M-c';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.supabaseClient = supabase;

// Utility functions
const db = {
    // User management
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    async getUserProfile(userId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    },

    async updateUserCoins(userId, coinChange) {
        const { data: user } = await this.getUserProfile(userId);
        const newCoins = Math.max(0, user.coins + coinChange);
        
        const { data, error } = await supabase
            .from('users')
            .update({ coins: newCoins })
            .eq('id', userId);
        return { data, error, newCoins };
    },

    // Campaign management
    async createCampaign(campaignData) {
        const { data, error } = await supabase
            .from('campaigns')
            .insert([campaignData])
            .select()
            .single();
        return { data, error };
    },

    async getActiveCampaigns(excludeUserId = null) {
        let query = supabase
            .from('campaigns')
            .select('*, users(name)')
            .eq('status', 'active');

        if (excludeUserId) {
            query = query.neq('user_id', excludeUserId);
        }

        const { data, error } = await query;
        return { data, error };
    },

    async getUserCampaigns(userId) {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async updateCampaignProgress(campaignId, intervalsCompleted) {
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        const newIntervals = campaign.current_intervals_completed + intervalsCompleted;
        let newStatus = campaign.status;

        if (newIntervals >= campaign.total_intervals) {
            newStatus = 'completed';
        }

        const { data, error } = await supabase
            .from('campaigns')
            .update({
                current_intervals_completed: newIntervals,
                status: newStatus
            })
            .eq('id', campaignId);

        return { data, error, newStatus };
    },

    // Watch logs
    async createWatchLog(watchData) {
        const { data, error } = await supabase
            .from('watch_logs')
            .insert([watchData]);
        return { data, error };
    },

    async getUserWatchLogs(userId) {
        const { data, error } = await supabase
            .from('watch_logs')
            .select('*, campaigns(video_url, video_length_sec)')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false });
        return { data, error };
    },

    // Payment management
    async createPaymentRequest(paymentData) {
        const { data, error } = await supabase
            .from('payments')
            .insert([paymentData]);
        return { data, error };
    },

    async getPaymentRequests(status = null) {
        let query = supabase
            .from('payments')
            .select('*, users(name, email)')
            .order('timestamp', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        return { data, error };
    },

    async updatePaymentStatus(paymentId, status) {
        const { data, error } = await supabase
            .from('payments')
            .update({ status })
            .eq('id', paymentId);
        return { data, error };
    },

    // Referral system
    async createReferral(referralData) {
        const { data, error } = await supabase
            .from('referrals')
            .insert([referralData]);
        return { data, error };
    },

    async getUserReferrals(userId) {
        const { data, error } = await supabase
            .from('referrals')
            .select('*, invitee:users(name, created_at)')
            .eq('inviter_id', userId);
        return { data, error };
    },

    // Admin functions
    async getAllUsers() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async getAllCampaigns() {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*, users(name, email)')
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async getPlatformStats() {
        const { data: users } = await supabase
            .from('users')
            .select('count');

        const { data: campaigns } = await supabase
            .from('campaigns')
            .select('count');

        const { data: activeCampaigns } = await supabase
            .from('campaigns')
            .select('count')
            .eq('status', 'active');

        const { data: payments } = await supabase
            .from('payments')
            .select('amount')
            .eq('status', 'approved');

        const totalRevenue = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

        return {
            totalUsers: users?.[0]?.count || 0,
            totalCampaigns: campaigns?.[0]?.count || 0,
            activeCampaigns: activeCampaigns?.[0]?.count || 0,
            totalRevenue
        };
    }
};

window.db = db;
