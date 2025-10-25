// Authentication Management - UPDATED VERSION
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.init();
    }

    async init() {
        try {
            // Wait for Supabase to be ready
            if (!supabaseManager.isReady()) {
                console.log('Waiting for Supabase initialization...');
                setTimeout(() => this.init(), 1000);
                return;
            }

            const supabase = supabaseManager.getClient();

            // Check for existing session
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error('Session check error:', error);
                return;
            }

            if (session) {
                this.currentUser = session.user;
                await this.loadUserProfile();
                this.onAuthStateChange(true);
            }

            // Listen for auth state changes
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('Auth state changed:', event, session);
                
                if (event === 'SIGNED_IN' && session) {
                    this.currentUser = session.user;
                    await this.loadUserProfile();
                    this.onAuthStateChange(true);
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.userProfile = null;
                    this.onAuthStateChange(false);
                } else if (event === 'USER_UPDATED') {
                    await this.loadUserProfile();
                }
            });

        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    async loadUserProfile() {
        if (!this.currentUser) return;
        
        try {
            const { data, error } = await db.getUserProfile(this.currentUser.id);
            if (error) {
                console.error('Error loading user profile:', error);
                return;
            }
            this.userProfile = data;
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
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
        try {
            if (!supabaseManager.isReady()) {
                throw new Error('Database not ready. Please try again.');
            }

            // Validate inputs
            if (!email || !password || !name) {
                throw new Error('Please fill in all required fields');
            }

            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            console.log('Starting signup process...');

            // Use db.signUp which handles both auth and profile creation
            const result = await db.signUp(email, password, name, referralCode);
            
            if (result && result.user) {
                await this.loadUserProfile();
                return result;
            }

            throw new Error('Signup failed - no user returned');

        } catch (error) {
            console.error('Signup error:', error);
            
            // Provide user-friendly error messages
            let userMessage = error.message;
            
            if (error.message.includes('Invalid login credentials')) {
                userMessage = 'Invalid email or password';
            } else if (error.message.includes('User already registered')) {
                userMessage = 'An account with this email already exists';
            } else if (error.message.includes('Email not confirmed')) {
                userMessage = 'Please check your email to confirm your account';
            } else if (error.message.includes('JWT')) {
                userMessage = 'Authentication service error. Please check your configuration.';
            }
            
            throw new Error(userMessage);
        }
    }

    async signIn(email, password) {
        try {
            if (!supabaseManager.isReady()) {
                throw new Error('Database not ready. Please try again.');
            }

            const result = await db.signIn(email, password);
            return result;

        } catch (error) {
            console.error('Signin error:', error);
            
            let userMessage = error.message;
            if (error.message.includes('Invalid login credentials')) {
                userMessage = 'Invalid email or password';
            } else if (error.message.includes('Email not confirmed')) {
                userMessage = 'Please confirm your email before signing in';
            }
            
            throw new Error(userMessage);
        }
    }

    async signOut() {
        try {
            await db.signOut();
            this.currentUser = null;
            this.userProfile = null;
            this.onAuthStateChange(false);
        } catch (error) {
            console.error('Signout error:', error);
            throw error;
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

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }
}

// Initialize auth manager
const authManager = new AuthManager();
window.authManager = authManager;
