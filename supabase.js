// Supabase Configuration - UPDATED VERSION
class SupabaseManager {
    constructor() {
        this.supabase = null;
        this.isInitialized = false;
        this.init();
    }

    init() {
        try {
            // Check if Supabase is available
            if (typeof window.supabase === 'undefined') {
                console.error('Supabase JS library not loaded');
                this.loadSupabaseLibrary();
                return;
            }

            // Your Supabase project details - UPDATE THESE!
            const SUPABASE_URL = 'https://zhkasyvmkcraaallsacn.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoa2FzeXZta2NyYWFhbGxzYWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjkxMTcsImV4cCI6MjA3NjgwNTExN30.RqzYkSQjS2sN8yQteyEBQnZurVRxkAVicO6sQPh-M-c';

            // Validate credentials
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new Error('Supabase URL or API key is missing');
            }

            if (!SUPABASE_URL.includes('supabase.co')) {
                throw new Error('Invalid Supabase URL');
            }

            // Initialize Supabase client
            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                }
            });

            this.isInitialized = true;
            console.log('Supabase initialized successfully');

            // Test connection
            this.testConnection();

        } catch (error) {
            console.error('Error initializing Supabase:', error);
            this.showConfigError(error.message);
        }
    }

    loadSupabaseLibrary() {
        // Dynamically load Supabase if not available
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/dist/umd/supabase.min.js';
        script.onload = () => {
            console.log('Supabase library loaded dynamically');
            this.init();
        };
        script.onerror = () => {
            console.error('Failed to load Supabase library');
            this.showConfigError('Failed to load Supabase library. Please check your internet connection.');
        };
        document.head.appendChild(script);
    }

    async testConnection() {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase.from('users').select('count').limit(1);
            
            if (error) {
                if (error.message.includes('JWT')) {
                    console.error('JWT error - possible API key issue');
                    this.showConfigError('Invalid API key. Please check your Supabase configuration.');
                } else {
                    console.log('Supabase connected, but table might not exist:', error.message);
                }
            } else {
                console.log('Supabase connection test successful');
            }
        } catch (error) {
            console.error('Connection test failed:', error);
        }
    }

    showConfigError(message) {
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        `;
        errorDiv.innerHTML = `
            <strong>Configuration Error</strong>
            <p style="margin: 0.5rem 0; font-size: 0.9rem;">${message}</p>
            <button onclick="this.parentElement.remove()" style="background: white; color: #ef4444; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Dismiss
            </button>
        `;
        document.body.appendChild(errorDiv);
    }

    // Get Supabase client instance
    getClient() {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }
        return this.supabase;
    }

    // Check if Supabase is ready
    isReady() {
        return this.isInitialized && this.supabase !== null;
    }
}

// Initialize and export
const supabaseManager = new SupabaseManager();
window.supabaseManager = supabaseManager;

// Database utility functions
const db = {
    async ensureReady() {
        if (!supabaseManager.isReady()) {
            throw new Error('Database not ready. Please check Supabase configuration.');
        }
        return supabaseManager.getClient();
    },

    // User management
    async getCurrentUser() {
        const supabase = await this.ensureReady();
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    async getUserProfile(userId) {
        const supabase = await this.ensureReady();
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    },

    async updateUserCoins(userId, coinChange) {
        const supabase = await this.ensureReady();
        const { data: user } = await this.getUserProfile(userId);
        const newCoins = Math.max(0, (user?.coins || 0) + coinChange);
        
        const { data, error } = await supabase
            .from('users')
            .update({ coins: newCoins, updated_at: new Date().toISOString() })
            .eq('id', userId);
        return { data, error, newCoins };
    },

    // Authentication
    async signUp(email, password, name, referralCode = null) {
        const supabase = await this.ensureReady();
        
        // First, create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name,
                    referral_code: referralCode
                }
            }
        });

        if (authError) {
            throw authError;
        }

        if (authData.user) {
            // Create user profile
            const userData = {
                id: authData.user.id,
                name: name,
                email: email,
                coins: 30, // Signup bonus
                referral_code: this.generateReferralCode(name),
                referred_by: referralCode || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error: profileError } = await supabase
                .from('users')
                .insert([userData]);

            if (profileError) {
                console.error('Error creating user profile:', profileError);
                // Try to delete the auth user if profile creation fails
                await supabase.auth.admin.deleteUser(authData.user.id);
                throw profileError;
            }

            // Handle referral bonus if applicable
            if (referralCode) {
                await this.processReferralBonus(referralCode, authData.user.id);
            }

            return authData;
        }

        return null;
    },

    async signIn(email, password) {
        const supabase = await this.ensureReady();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        return data;
    },

    async signOut() {
        const supabase = await this.ensureReady();
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }
    },

    generateReferralCode(name) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const namePart = name ? name.substring(0, 3).toUpperCase() : 'USER';
        return `SG-${namePart}-${randomNum}`;
    },

    async processReferralBonus(referralCode, newUserId) {
        const supabase = await this.ensureReady();
        
        // Find inviter by referral code
        const { data: inviter } = await supabase
            .from('users')
            .select('id')
            .eq('referral_code', referralCode)
            .single();

        if (inviter) {
            // Create referral record
            await supabase
                .from('referrals')
                .insert([{
                    inviter_id: inviter.id,
                    invitee_id: newUserId,
                    bonus_coins: 50,
                    timestamp: new Date().toISOString()
                }]);

            // Add bonus coins to inviter
            await this.updateUserCoins(inviter.id, 50);
        }
    },

    // Campaign management functions (same as before)
    async createCampaign(campaignData) {
        const supabase = await this.ensureReady();
        const { data, error } = await supabase
            .from('campaigns')
            .insert([campaignData])
            .select()
            .single();
        return { data, error };
    },

    async getActiveCampaigns(excludeUserId = null) {
        const supabase = await this.ensureReady();
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

    // ... include all other database functions from previous version
};

window.db = db;
