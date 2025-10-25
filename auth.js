// Authentication Management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.init();
    }

    async init() {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            await this.loadUserProfile();
            this.onAuthStateChange(true);
        }

        // Listen for auth state changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
                await this.loadUserProfile();
                this.onAuthStateChange(true);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.userProfile = null;
                this.onAuthStateChange(false);
            }
        });
    }

    async loadUserProfile() {
        if (!this.currentUser) return;
        
        const { data, error } = await db.getUserProfile(this.currentUser.id);
        if (error) {
            console.error('Error loading user profile:', error);
            return;
        }
        this.userProfile = data;
    }

    onAuthStateChange(isAuthenticated) {
        // Dispatch custom event for other components to listen to
        const event = new CustomEvent('authStateChange', {
            detail: { isAuthenticated, user: this.currentUser, profile: this.userProfile }
        });
        document.dispatchEvent(event);

        // Update UI based on auth state
        this.updateAuthUI(isAuthenticated);
    }

    updateAuthUI(isAuthenticated) {
        const authElements = document.querySelectorAll('[data-auth]');
        authElements.forEach(element => {
            const authState = element.getAttribute('data-auth');
            if (authState === 'authenticated') {
                element.style.display = isAuthenticated ? '' : 'none';
            } else if (authState === 'unauthenticated') {
                element.style.display = isAuthenticated ? 'none' : '';
            }
        });

        // Update user-specific elements
        if (isAuthenticated && this.userProfile) {
            const userNames = document.querySelectorAll('[data-user-name]');
            userNames.forEach(element => {
                element.textContent = this.userProfile.name || this.currentUser.email;
            });

            const userAvatars = document.querySelectorAll('[data-user-avatar]');
            userAvatars.forEach(element => {
                element.textContent = (this.userProfile.name || this.currentUser.email).charAt(0).toUpperCase();
            });
        }
    }

    async signUp(email, password, name, referralCode = null) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name
                }
            }
        });

        if (error) {
            throw error;
        }

        if (data.user) {
            // Create user profile with referral system
            const userData = {
                id: data.user.id,
                name: name,
                email: email,
                coins: 30, // Signup bonus
                referral_code: this.generateReferralCode(name),
                referred_by: referralCode || null
            };

            const { error: profileError } = await supabase
                .from('users')
                .insert([userData]);

            if (profileError) {
                console.error('Error creating user profile:', profileError);
                throw profileError;
            }

            // Handle referral bonus if applicable
            if (referralCode) {
                await this.processReferralBonus(referralCode, data.user.id);
            }

            await this.loadUserProfile();
        }

        return data;
    }

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        return data;
    }

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }
    }

    generateReferralCode(name) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `SG-${name.substring(0, 3).toUpperCase()}-${randomNum}`;
    }

    async processReferralBonus(referralCode, newUserId) {
        // Find inviter by referral code
        const { data: inviter } = await supabase
            .from('users')
            .select('id')
            .eq('referral_code', referralCode)
            .single();

        if (inviter) {
            // Create referral record
            await db.createReferral({
                inviter_id: inviter.id,
                invitee_id: newUserId,
                bonus_coins: 50
            });

            // Add bonus coins to inviter
            await db.updateUserCoins(inviter.id, 50);
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserProfile() {
        return this.userProfile;
    }

    isAdmin() {
        return this.userProfile?.role === 'admin';
    }
}

// Initialize auth manager
const authManager = new AuthManager();
window.authManager = authManager;
