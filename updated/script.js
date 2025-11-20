document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTS AND STATE ---
    const CURRENT_USER_KEY = 'currentUser';
    const USERS_KEY = 'users';
    const LANGUAGE_KEY = 'appLanguage';
    
    const state = {
        currentPage: 'splash-page',
        currentUser: null,
        userSubmissions: [],
        users: {},
        currentTest: null,
        isRecording: false,
        mediaRecorder: null,
        audioChunks: [],
        videoBlob: null,
        leaderboardScope: 'state', // district, state, national
        isEditingProfile: false,
    };

    // --- UTILITY FUNCTIONS ---
    const getFromLocalStorage = (key, defaultValue = null) => {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    };

    const saveToLocalStorage = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    const updateCurrentUserState = (user) => {
        state.currentUser = user;
        saveToLocalStorage(CURRENT_USER_KEY, user);
        // Also update the full user list
        const users = getFromLocalStorage(USERS_KEY, {});
        users[user.email] = user;
        saveToLocalStorage(USERS_KEY, users);
        updateUIForUser(user);
    };

    // --- NAVIGATION AND UI MANAGEMENT ---
    const navigateTo = (pageId, pushHistory = true) => {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
            page.style.display = 'none';
        });
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.style.display = 'flex';
            state.currentPage = pageId;
        }

        if (pageId === 'home-page' || pageId === 'submissions-page' || pageId === 'leaderboard-page' || pageId === 'info-page') {
             document.getElementById('main-content').classList.remove('hidden');
             updateNavBar(pageId);
        } else if (pageId === 'auth-page') {
            document.getElementById('main-content').classList.add('hidden');
        }

        if (pushHistory) {
            history.pushState({ page: pageId }, '', `#${pageId}`);
        }
        
        // Specific page rendering
        if (pageId === 'home-page') updateHomeUI();
        if (pageId === 'submissions-page') renderSubmissions();
        if (pageId === 'profile-page') renderProfile();
        if (pageId === 'test-selection-page') renderTestList();
        if (pageId === 'leaderboard-page') renderLeaderboard(state.leaderboardScope);
        if (pageId === 'record-page') startCamera();

        // Scroll to top of the new page
        if (targetPage) targetPage.scrollTop = 0;
    };

    const updateNavBar = (activePage) => {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active-nav-item');
            if (btn.getAttribute('data-page') === activePage) {
                btn.classList.add('active-nav-item');
            }
            // Update color based on active state
            if (btn.getAttribute('data-page') === activePage) {
                 btn.classList.remove('text-gray-500');
                 btn.classList.add('text-primary-600');
            } else {
                 btn.classList.remove('text-primary-600');
                 btn.classList.add('text-gray-500');
            }
        });
    };

    // --- AUTHENTICATION ---
    window.toggleAuthMode = () => {
        const isLogin = document.getElementById('toggle-auth-btn').dataset.translate === 'toggle-register';
        document.getElementById('login-form').classList.toggle('hidden');
        document.getElementById('register-form').classList.toggle('hidden');
        document.getElementById('login-error').textContent = '';
        document.getElementById('register-error').textContent = '';

        if (isLogin) {
            document.getElementById('toggle-auth-btn').dataset.translate = 'toggle-login';
        } else {
            document.getElementById('toggle-auth-btn').dataset.translate = 'toggle-register';
        }
        setLanguage(state.language);
    };

    window.handleLogin = () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';
        
        const users = getFromLocalStorage(USERS_KEY, {});
        const user = users[email];

        if (!user) {
            errorEl.textContent = 'User not found. Please register.';
            return;
        }

        if (user.password !== password) {
            errorEl.textContent = 'Invalid password.';
            return;
        }
        
        state.userSubmissions = getFromLocalStorage(`submissions_${user.email}`, []);
        updateCurrentUserState(user);
        navigateTo('home-page');
    };

    window.handleRegister = () => {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const age = parseInt(document.getElementById('register-age').value);
        const aadhaar = document.getElementById('register-aadhaar').value.trim();
        const phone = document.getElementById('register-phone').value.trim();
        const sport = document.getElementById('register-sport').value;
        const stateOfOrigin = document.getElementById('register-state').value;
        const religion = document.getElementById('register-religion').value;
        const errorEl = document.getElementById('register-error');
        errorEl.textContent = '';

        if (!name || !email || !password || !age || !aadhaar || !phone || !sport || !stateOfOrigin || !religion) {
            errorEl.textContent = 'All fields are required.';
            return;
        }

        if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            errorEl.textContent = 'Invalid email format.';
            return;
        }

        if (aadhaar.length !== 4) {
            errorEl.textContent = 'Aadhaar must be the last 4 digits.';
            return;
        }

        if (phone.length !== 10) {
            errorEl.textContent = 'Phone number must be 10 digits.';
            return;
        }

        const users = getFromLocalStorage(USERS_KEY, {});
        if (users[email]) {
            errorEl.textContent = 'User with this email already exists. Please log in.';
            return;
        }

        const newUser = {
            name, email, password, age, sport, state: stateOfOrigin, religion, aadhaar, phone,
            xp: 0,
            level: 1,
            profilePic: 'https://i.pravatar.cc/150?img=' + Math.floor(Math.random() * 70 + 1)
        };

        users[email] = newUser;
        saveToLocalStorage(USERS_KEY, users);
        
        state.userSubmissions = [];
        updateCurrentUserState(newUser);
        navigateTo('home-page');
    };

    window.handleLogout = () => {
        saveToLocalStorage(CURRENT_USER_KEY, null);
        state.currentUser = null;
        state.userSubmissions = [];
        navigateTo('auth-page');
    };

    // --- HOME PAGE UI ---
    const getLevelInfo = (xp) => {
        const level = Math.floor(xp / 100) + 1;
        const xpForCurrentLevel = (level - 1) * 100;
        const xpForNextLevel = level * 100;
        const progress = ((xp - xpForCurrentLevel) / 100) * 100;
        return { level, xpForCurrentLevel, xpForNextLevel, progress };
    };

    const getBadges = (xp) => {
        const badges = [];
        if (xp >= 100) badges.push({ id: 'rookie', icon: 'medal', color: 'yellow' });
        if (xp >= 500) badges.push({ id: 'elite', icon: 'zap', color: 'purple' });
        if (xp >= 1000) badges.push({ id: 'legend', icon: 'crown', color: 'red' });
        if (xp >= 2000) badges.push({ id: 'top-tier', icon: 'star', color: 'green' });
        return badges;
    };

    const updateUIForUser = (user) => {
        document.getElementById('home-username').textContent = user.name.split(' ')[0];
        document.getElementById('profile-name').textContent = user.name;
        document.getElementById('my-leaderboard-name').textContent = user.name;
        document.getElementById('profile-sport').textContent = user.sport.toUpperCase();
        document.getElementById('profile-xp').textContent = user.xp.toLocaleString();
        document.getElementById('my-leaderboard-xp').textContent = user.xp.toLocaleString();
        document.getElementById('profile-picture').src = user.profilePic;
        document.getElementById('profile-age').textContent = `${user.age} Years Old`;
    };

    const updateHomeUI = () => {
        const user = state.currentUser;
        if (!user) return;
        
        updateUIForUser(user);
        
        const { level, xpForNextLevel, progress } = getLevelInfo(user.xp);
        
        document.getElementById('current-xp').textContent = user.xp.toLocaleString();
        document.getElementById('current-level').textContent = `Level ${level}`;
        document.getElementById('xp-to-next-level').textContent = `${user.xp % 100}/100 XP to Level ${level + 1}`;
        document.getElementById('xp-progress-bar').style.width = `${progress}%`;
        document.getElementById('profile-level-display').textContent = level;
    };

    // --- PROFILE PAGE ---
    window.toggleEditProfile = () => {
        state.isEditingProfile = !state.isEditingProfile;
        const form = document.getElementById('profile-edit-form');
        const editBtn = document.getElementById('edit-profile-btn');
        
        if (state.isEditingProfile) {
            form.classList.remove('hidden');
            editBtn.textContent = translations[state.language]['cancel-btn'];
            
            // Populate form fields
            document.getElementById('edit-name').value = state.currentUser.name;
            document.getElementById('edit-age').value = state.currentUser.age;
            document.getElementById('edit-sport').value = state.currentUser.sport;
        } else {
            form.classList.add('hidden');
            editBtn.textContent = translations[state.language]['edit-btn'];
        }
    };

    window.saveProfile = () => {
        const newName = document.getElementById('edit-name').value.trim();
        const newAge = parseInt(document.getElementById('edit-age').value);
        const newSport = document.getElementById('edit-sport').value;
        
        if (newName && newAge && newSport) {
            const updatedUser = {
                ...state.currentUser,
                name: newName,
                age: newAge,
                sport: newSport,
            };
            
            updateCurrentUserState(updatedUser);
            toggleEditProfile(); // Hide form
            renderProfile(); // Re-render profile with new data
        }
    };

    window.previewProfilePicture = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const updatedUser = { ...state.currentUser, profilePic: e.target.result };
                updateCurrentUserState(updatedUser);
                renderProfile();
            };
            reader.readAsDataURL(file);
        }
    };

    const renderProfile = () => {
        const user = state.currentUser;
        if (!user) return;

        updateUIForUser(user);
        
        // Render Badges
        const badgesContainer = document.getElementById('badges-container');
        badgesContainer.innerHTML = '';
        
        const earnedBadges = getBadges(user.xp);
        const allBadgeData = {
            rookie: { icon: 'medal', color: 'yellow', xp: 100 },
            elite: { icon: 'zap', color: 'purple', xp: 500 },
            legend: { icon: 'crown', color: 'red', xp: 1000 },
            'top-tier': { icon: 'star', color: 'green', xp: 2000 },
        };

        Object.keys(allBadgeData).forEach(badgeId => {
            const badge = allBadgeData[badgeId];
            const isEarned = earnedBadges.some(b => b.id === badgeId);
            const opacityClass = isEarned ? 'opacity-100' : 'opacity-30';
            const colorClass = isEarned ? `text-${badge.color}-500` : 'text-gray-400';
            const titleKey = `badge-${badgeId}`;

            badgesContainer.innerHTML += `
                <div class="badge-item ${opacityClass} transition duration-300" title="${translations[state.language][titleKey]} (${badge.xp} XP)">
                    <svg data-lucide="${badge.icon}" class="w-10 h-10 mx-auto ${colorClass}"></svg>
                    <p data-translate="${titleKey}" class="text-xs font-medium mt-1 text-gray-800">${translations[state.language][titleKey]}</p>
                </div>
            `;
        });

        // Re-create icons after updating HTML
        lucide.createIcons();
    };

    // --- TEST SELECTION ---
    const testData = [
        { id: 'pushups', icon: 'armchair', titleKey: 'test-pushups-title', descKey: 'test-pushups-desc', instructions: 'Maintain straight posture. Chest to ground. Max reps in 60 seconds.' },
        { id: '40m-sprint', icon: 'zap', titleKey: 'test-sprint-title', descKey: 'test-sprint-desc', instructions: 'Start from a standing position. Video must clearly show start and finish lines. Measures max speed.' },
        { id: 'vertical-jump', icon: 'chevrons-up', titleKey: 'test-jump-title', descKey: 'test-jump-desc', instructions: 'Use chalk on fingers. Mark standing reach. Mark jump height. Measures explosive power.' },
        { id: 'plank', icon: 'square', titleKey: 'test-plank-title', descKey: 'test-plank-desc', instructions: 'Maintain a straight body line from head to heels. Max hold time in seconds.' },
    ];

    const renderTestList = () => {
        const testListEl = document.getElementById('test-list');
        testListEl.innerHTML = testData.map(test => `
            <div data-test-id="${test.id}" class="bg-white p-4 rounded-xl shadow-md flex items-center justify-between hover:shadow-lg transition cursor-pointer" onclick="selectTest('${test.id}')">
                <div class="flex items-center">
                    <svg data-lucide="${test.icon}" class="w-8 h-8 text-primary-500 mr-3"></svg>
                    <div>
                        <p data-translate="${test.titleKey}" class="font-bold text-gray-800">${translations[state.language][test.titleKey]}</p>
                        <p data-translate="${test.descKey}" class="text-sm text-gray-500">${translations[state.language][test.descKey]}</p>
                    </div>
                </div>
                <svg data-lucide="chevron-right" class="w-5 h-5 text-gray-400"></svg>
            </div>
        `).join('');
        lucide.createIcons();
    };

    window.selectTest = (testId) => {
        state.currentTest = testData.find(t => t.id === testId);
        if (state.currentTest) {
            document.getElementById('test-name-submit').textContent = translations[state.language][state.currentTest.titleKey];
            document.getElementById('test-instructions').textContent = state.currentTest.instructions;
            navigateTo('submission-options-page');
        }
    };

    // --- SUBMISSION LOGIC (Mock) ---
    window.submitVideo = () => {
        if (!state.currentTest) return;

        // Mock submission object
        const newSubmission = {
            id: Date.now(),
            testId: state.currentTest.id,
            testName: translations[state.language][state.currentTest.titleKey],
            date: new Date().toISOString().slice(0, 10),
            status: 'PENDING',
            score: null,
            xpEarned: 0,
            feedback: '',
        };

        state.userSubmissions.unshift(newSubmission); // Add to start
        saveToLocalStorage(`submissions_${state.currentUser.email}`, state.userSubmissions);
        
        alert(translations[state.language]['submission-success']);
        navigateTo('submissions-page');
    };
    
    // Refresh Button Logic (Mock Review Process)
    window.refreshStatusBtn = document.getElementById('refreshStatusBtn');
    if(refreshStatusBtn) {
        refreshStatusBtn.addEventListener('click', () => {
            let pendingCount = 0;
            state.userSubmissions = state.userSubmissions.map(sub => {
                if (sub.status === 'PENDING') {
                    pendingCount++;
                    // 70% chance of approval
                    if (Math.random() < 0.7) { 
                        sub.status = 'APPROVED';
                        const minXp = 50;
                        const maxXp = 200;
                        sub.xpEarned = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;
                        sub.score = Math.floor(Math.random() * 50) + 10; // Mock score
                        sub.feedback = 'Excellent form and effort!';
                        
                        // Update user XP
                        state.currentUser.xp += sub.xpEarned;
                    } else {
                        sub.status = 'REJECTED';
                        sub.score = 0;
                        sub.xpEarned = 0;
                        sub.feedback = 'Video quality too low or form inconsistency detected.';
                    }
                }
                return sub;
            });
            
            if (pendingCount > 0) {
                saveToLocalStorage(`submissions_${state.currentUser.email}`, state.userSubmissions);
                updateCurrentUserState(state.currentUser); // Update user XP
                renderSubmissions(); // Re-render the list
                alert(`${pendingCount} submission(s) updated. Check your activity.`);
            } else {
                alert('No pending submissions to refresh.');
            }
        });
    }

    const renderSubmissions = () => {
        const listEl = document.getElementById('submissions-list');
        const noSubmissionsEl = document.getElementById('no-submissions');
        
        if (state.userSubmissions.length === 0) {
            listEl.innerHTML = '';
            noSubmissionsEl.classList.remove('hidden');
            return;
        }

        noSubmissionsEl.classList.add('hidden');
        listEl.innerHTML = state.userSubmissions.map(sub => {
            let statusColor = '';
            let details = '';
            let icon = '';

            if (sub.status === 'PENDING') {
                statusColor = 'text-yellow-600 bg-yellow-100';
                details = translations[state.language]['submission-pending-text'];
                icon = 'loader';
            } else if (sub.status === 'APPROVED') {
                statusColor = 'text-green-600 bg-green-100';
                details = `${translations[state.language]['submission-score']}: ${sub.score} / ${translations[state.language]['submission-xpearned']}: +${sub.xpEarned}`;
                icon = 'check-circle';
            } else {
                statusColor = 'text-red-600 bg-red-100';
                details = `${translations[state.language]['submission-rejected-text']}. ${translations[state.language]['submission-feedback']}: ${sub.feedback}`;
                icon = 'x-circle';
            }
            
            return `
                <div class="bg-white p-4 rounded-xl shadow-md submission-card border-l-4 ${sub.status === 'APPROVED' ? 'border-green-500' : sub.status === 'PENDING' ? 'border-yellow-500' : 'border-red-500'}">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-lg text-gray-800">${sub.testName}</span>
                        <div class="flex items-center space-x-2">
                           <svg data-lucide="${icon}" class="w-5 h-5 ${sub.status === 'APPROVED' ? 'text-green-500' : sub.status === 'PENDING' ? 'text-yellow-500' : 'text-red-500'}"></svg>
                           <span class="text-sm font-semibold ${statusColor} px-3 py-1 rounded-full">${translations[state.language][`status-${sub.status.toLowerCase()}`]}</span>
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">${translations[state.language]['submission-submitted-on']}: ${sub.date}</p>
                    <p class="text-sm text-gray-700 mt-2">${details}</p>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    };

    // --- LEADERBOARD ---
    const mockAllUsers = () => {
        const users = getFromLocalStorage(USERS_KEY, {});
        // Ensure some mock users exist for the leaderboard
        if (Object.keys(users).length < 5) {
            for (let i = 1; i <= 5; i++) {
                const email = `mock${i}@sai.in`;
                if (!users[email]) {
                    users[email] = {
                        name: `Mock Athlete ${i}`,
                        email: email,
                        sport: i % 2 === 0 ? 'athletics' : 'swimming',
                        state: i % 3 === 0 ? 'tamil-nadu' : 'maharashtra',
                        xp: (5000 - i * 500) + Math.floor(Math.random() * 200),
                        level: getLevelInfo(5000 - i * 500).level,
                        profilePic: `https://i.pravatar.cc/150?img=${10 + i}`,
                    };
                }
            }
            saveToLocalStorage(USERS_KEY, users);
        }
        return Object.values(users);
    };

    window.changeLeaderboard = (scope) => {
        state.leaderboardScope = scope;
        document.querySelectorAll('.leaderboard-scope-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.remove('border-b-2', 'border-primary-600', 'text-primary-600');
            if (btn.dataset.scope === scope) {
                btn.classList.add('active');
                btn.classList.add('border-b-2', 'border-primary-600', 'text-primary-600');
            }
        });
        renderLeaderboard(scope);
    };

    const renderLeaderboard = (scope) => {
        const allUsers = mockAllUsers();
        let filteredUsers = [...allUsers];
        
        if (scope === 'state' && state.currentUser) {
            filteredUsers = allUsers.filter(u => u.state === state.currentUser.state);
        }
        // District filter is mock and uses state as proxy for simplicity
        if (scope === 'district' && state.currentUser) {
            filteredUsers = allUsers.filter(u => u.state === state.currentUser.state);
        }
        // 'national' is all users
        
        filteredUsers.sort((a, b) => b.xp - a.xp);

        const listEl = document.getElementById('leaderboard-list');
        listEl.innerHTML = '';

        const currentUserRank = filteredUsers.findIndex(u => u.email === state.currentUser.email) + 1;
        document.getElementById('my-rank').textContent = currentUserRank > 0 ? `#${currentUserRank}` : 'N/A';
        document.querySelector('.text-sm.text-primary-700.font-semibold').textContent = `${translations[state.language]['leaderboard-myrank']} (${translations[state.language][`leaderboard-${scope}`]})`;
        
        filteredUsers.slice(0, 10).forEach((user, index) => {
            const isMe = user.email === state.currentUser.email;
            listEl.innerHTML += `
                <div class="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between ${isMe ? 'bg-primary-50 border-2 border-primary-400' : ''}">
                    <div class="flex items-center">
                        <span class="text-lg font-bold w-6 text-center ${isMe ? 'text-primary-700' : 'text-gray-600'}">#${index + 1}</span>
                        <img src="${user.profilePic}" alt="Profile" class="w-10 h-10 rounded-full object-cover ml-3">
                        <div class="ml-3">
                            <p class="font-semibold text-gray-800">${user.name}</p>
                            <p class="text-xs text-gray-500">${user.sport.toUpperCase()}</p>
                        </div>
                    </div>
                    <span class="text-lg font-bold ${isMe ? 'text-primary-700' : 'text-primary-600'}">${user.xp.toLocaleString()} XP</span>
                </div>
            `;
        });
    };

    // --- CAMERA/VIDEO LOGIC (MOCK) ---
    let mediaStream = null;

    const startCamera = async () => {
        const videoPreview = document.getElementById('video-preview');
        const errorDiv = document.getElementById('camera-access-error');
        const startBtn = document.getElementById('start-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        const submitBtn = document.getElementById('submit-recorded-btn');

        stopBtn.classList.add('hidden');
        submitBtn.classList.add('hidden');
        startBtn.classList.remove('hidden');
        errorDiv.classList.add('hidden');

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            videoPreview.srcObject = mediaStream;
            videoPreview.style.display = 'block';
        } catch (err) {
            console.error('Error accessing camera/mic: ', err);
            errorDiv.classList.remove('hidden');
            videoPreview.style.display = 'none';
            startBtn.disabled = true;
        }
    };

    window.startRecording = () => {
        if (!mediaStream) return;
        
        const videoPreview = document.getElementById('video-preview');
        const startBtn = document.getElementById('start-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        const statusEl = document.getElementById('recording-status');
        const submitBtn = document.getElementById('submit-recorded-btn');

        state.audioChunks = [];
        state.mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm; codecs=vp8,opus' });

        state.mediaRecorder.ondataavailable = (event) => {
            state.audioChunks.push(event.data);
        };

        state.mediaRecorder.onstop = () => {
            state.videoBlob = new Blob(state.audioChunks, { 'type' : 'video/webm' });
            videoPreview.srcObject = null;
            videoPreview.src = URL.createObjectURL(state.videoBlob);
            videoPreview.controls = true;
            statusEl.textContent = translations[state.language]['record-finished'];
            submitBtn.classList.remove('hidden');
        };

        state.mediaRecorder.start();
        state.isRecording = true;
        
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        submitBtn.classList.add('hidden');
        statusEl.textContent = translations[state.language]['record-in-progress'];
    };

    window.stopRecording = () => {
        if (!state.isRecording || !state.mediaRecorder) return;

        state.mediaRecorder.stop();
        state.isRecording = false;

        const startBtn = document.getElementById('start-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        
        // Stop all media tracks
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;

        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    };

    // Upload Page Handlers
    window.previewUploadedVideo = (event) => {
        const file = event.target.files[0];
        const videoPreview = document.getElementById('uploaded-video-preview');
        const noVideo = document.getElementById('no-video-preview');
        const submitBtn = document.getElementById('submit-uploaded-btn');
        const fileNameEl = document.getElementById('uploaded-file-name');

        if (file && file.type.startsWith('video/')) {
            const fileURL = URL.createObjectURL(file);
            videoPreview.src = fileURL;
            state.videoBlob = file; // Store the file object as the mock blob
            
            noVideo.style.display = 'none';
            submitBtn.disabled = false;
            fileNameEl.textContent = `${translations[state.language]['file-selected']}: ${file.name}`;
        } else {
            videoPreview.src = '';
            state.videoBlob = null;
            noVideo.style.display = 'flex';
            submitBtn.disabled = true;
            fileNameEl.textContent = translations[state.language]['no-file-selected'];
            alert(translations[state.language]['not-a-video']);
        }
    };

    // --- TRANSLATION DATA ---
    const translations = {
        en: {
            // General
            'edit-btn': 'Edit',
            'save-btn': 'Save Changes',
            'cancel-btn': 'Cancel',
            'logout-btn': 'Logout',
            'submission-success': 'Submission successful! Awaiting review.',
            'not-a-video': 'Selected file is not a video.',
            'file-selected': 'File Selected',
            'no-file-selected': 'No file selected.',
            
            // Auth
            'auth-welcome': 'Welcome Athlete',
            'auth-subtitle': 'Log in or Register to begin your journey.',
            'login-btn': 'Login',
            'register-btn': 'Register',
            'toggle-register': 'Don\'t have an account? Register',
            'toggle-login': 'Already have an account? Login',
            'email-placeholder': 'Email',
            'password-placeholder': 'Password',
            'name-placeholder': 'Full Name',
            'age-placeholder': 'Age',
            'aadhaar-placeholder': 'Aadhaar (Last 4)',
            'phone-placeholder': 'Phone Number',
            'sport-placeholder': 'Select Primary Sport',
            'state-placeholder': 'Select State',
            'religion-placeholder': 'Select Religion',
            'sport-athletics': 'Athletics',
            'sport-swimming': 'Swimming',
            'sport-archery': 'Archery',
            'sport-boxing': 'Boxing',
            'sport-football': 'Football',
            'sport-basketball': 'Basketball',

            // Navigation
            'nav-home': 'Home',
            'nav-activity': 'Activity',
            'nav-leaderboard': 'Leaderboard',
            'nav-info': 'Info',

            // Home
            'home-welcome': 'Welcome back,',
            'xp-title': 'Experience Points (XP)',
            'start-test-btn': 'Start New Test',
            'missions-title': 'Daily Missions',
            'mission-speed': 'Speed Demon: Complete one 40m Sprint test today.',
            'mission-plank': 'Iron Core: Achieve a plank time of 120 seconds or more.',

            // Activity
            'activity-title': 'Activity & Submissions',
            'refresh-btn': 'Refresh Status',
            'no-activity': 'No activity recorded yet.',
            'submission-submitted-on': 'Submitted on',
            'submission-score': 'Score',
            'submission-xpearned': 'XP Earned',
            'submission-pending-text': 'Awaiting coach review.',
            'submission-rejected-text': 'Video rejected',
            'submission-feedback': 'Feedback',
            'status-pending': 'PENDING',
            'status-approved': 'APPROVED',
            'status-rejected': 'REJECTED',

            // Leaderboard
            'leaderboard-title': 'Leaderboard',
            'leaderboard-district': 'District',
            'leaderboard-state': 'State',
            'leaderboard-national': 'National',
            'leaderboard-myrank': 'Your Rank',
            'leaderboard-xp': 'Total XP',

            // Profile
            'profile-title': 'My Profile',
            'profile-level': 'Level',
            'edit-title': 'Edit Details',
            'badges-title': 'Badges Earned',
            'badge-rookie': 'Rookie',
            'badge-elite': 'Elite',
            'badge-legend': 'Legend',
            'badge-top-tier': 'Top Tier',

            // Tests
            'test-select-title': 'Select Performance Test',
            'test-pushups-title': 'Push-ups (Max in 60 sec)',
            'test-pushups-desc': 'Measures muscular endurance.',
            'test-sprint-title': '40m Sprint',
            'test-sprint-desc': 'Measures max speed and acceleration.',
            'test-jump-title': 'Vertical Jump',
            'test-jump-desc': 'Measures explosive leaping ability.',
            'test-plank-title': 'Plank',
            'test-plank-desc': 'Measures core strength and stability.',

            // Submission
            'submit-title': 'Submit',
            'instructions-title': 'Instructions',
            'record-video-btn': 'Record Live Video',
            'upload-file-btn': 'Upload from Device',
            'submit-video-btn': 'Submit Video for Review',

            // Record
            'record-title': 'Record Video',
            'camera-error-message': 'Camera access denied or not available. Please check permissions.',
            'start-record-btn': 'Start Record',
            'stop-record-btn': 'Stop Record',
            'recording-status': 'Ready to record...',
            'record-in-progress': 'Recording...',
            'record-finished': 'Recording finished. Ready to submit.',

            // Upload
            'upload-title': 'Upload Video',
            'choose-file-btn': 'Choose Video File',
            'no-video-selected': 'No video selected for preview.',

            // Info
            'info-title': 'About & Policy',
            'about-app': 'About TalentTrack Pro',
            'about-body': 'TalentTrack Pro is an official tool by the **Sports Authority of India (SAI)** designed to democratize athlete performance tracking and talent identification. It aims to create a nationwide database of sports talent, ensuring no deserving athlete is overlooked, regardless of their location.',
            'policy-title': 'Fair Play Policy',
            'policy-point-1': 'All test submissions must be in the form of authentic, unedited videos.',
            'policy-point-2': 'The platform uses **AI-powered video analysis** to detect inconsistencies and potential cheating.',
            'policy-point-3': 'Any submission found to be fraudulent will result in immediate rejection and potential profile suspension.',
            'policy-point-4': 'Scores are reviewed by certified SAI coaches before XP is awarded.',
        },
        ta: {
            // General
            'edit-btn': 'திருத்து',
            'save-btn': 'மாற்றங்களைச் சேமி',
            'cancel-btn': 'ரத்து செய்',
            'logout-btn': 'வெளியேறு',
            'submission-success': 'சமர்ப்பிப்பு வெற்றி! மதிப்பாய்வுக்காக காத்திருக்கிறது.',
            'not-a-video': 'தேர்ந்தெடுக்கப்பட்ட கோப்பு வீடியோ அல்ல.',
            'file-selected': 'கோப்பு தேர்ந்தெடுக்கப்பட்டது',
            'no-file-selected': 'கோப்பு எதுவும் தேர்ந்தெடுக்கப்படவில்லை.',
            
            // Auth
            'auth-welcome': 'வரவேற்கிறோம் விளையாட்டு வீரரே',
            'auth-subtitle': 'உங்கள் பயணத்தைத் தொடங்க உள்நுழையவும் அல்லது பதிவு செய்யவும்.',
            'login-btn': 'உள்நுழைக',
            'register-btn': 'பதிவு செய்',
            'toggle-register': 'கணக்கு இல்லையா? பதிவு செய்யவும்',
            'toggle-login': 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைக',
            'email-placeholder': 'மின்னஞ்சல்',
            'password-placeholder': 'கடவுச்சொல்',
            'name-placeholder': 'முழு பெயர்',
            'age-placeholder': 'வயது',
            'aadhaar-placeholder': 'ஆதார் (கடைசி 4)',
            'phone-placeholder': 'தொலைபேசி எண்',
            'sport-placeholder': 'முதன்மை விளையாட்டைத் தேர்ந்தெடுக்கவும்',
            'state-placeholder': 'மாநிலத்தைத் தேர்ந்தெடுக்கவும்',
            'religion-placeholder': 'மதத்தைத் தேர்ந்தெடுக்கவும்',
            'sport-athletics': 'தடகளம்',
            'sport-swimming': 'நீச்சல்',
            'sport-archery': 'வில்வித்தை',
            'sport-boxing': 'குத்துச்சண்டை',
            'sport-football': 'கால்பந்து',
            'sport-basketball': 'கூடைப்பந்து',

            // Navigation
            'nav-home': 'முகப்பு',
            'nav-activity': 'செயல்பாடு',
            'nav-leaderboard': 'தரவரிசைப் பலகை',
            'nav-info': 'தகவல்',

            // Home
            'home-welcome': 'மீண்டும் வரவேற்கிறோம்,',
            'xp-title': 'அனுபவப் புள்ளிகள் (XP)',
            'start-test-btn': 'புதிய சோதனையைத் தொடங்கு',
            'missions-title': 'தினசரி இலக்குகள்',
            'mission-speed': 'வேக அசுரன்: இன்று ஒரு 40மீ ஸ்பிரிண்ட் சோதனையை முடிக்கவும்.',
            'mission-plank': 'இரும்பு மையப்பகுதி: 120 வினாடிகள் அல்லது அதற்கு மேல் பிளாங் நேரத்தை அடையவும்.',

            // Activity
            'activity-title': 'செயல்பாடு & சமர்ப்பிப்புகள்',
            'refresh-btn': 'நிலையை புதுப்பி',
            'no-activity': 'செயல்பாடு எதுவும் பதிவு செய்யப்படவில்லை.',
            'submission-submitted-on': 'சமர்ப்பிக்கப்பட்டது',
            'submission-score': 'மதிப்பெண்',
            'submission-xpearned': 'பெற்ற XP',
            'submission-pending-text': 'பயிற்சியாளரின் மதிப்பாய்வுக்காக காத்திருக்கிறது.',
            'submission-rejected-text': 'வீடியோ நிராகரிக்கப்பட்டது',
            'submission-feedback': 'கருத்து',
            'status-pending': 'காத்திருப்பு',
            'status-approved': 'அங்கீகரிக்கப்பட்டது',
            'status-rejected': 'நிராகரிக்கப்பட்டது',

            // Leaderboard
            'leaderboard-title': 'தரவரிசைப் பலகை',
            'leaderboard-district': 'மாவட்டம்',
            'leaderboard-state': 'மாநிலம்',
            'leaderboard-national': 'தேசிய',
            'leaderboard-myrank': 'உங்கள் தரவரிசை',
            'leaderboard-xp': 'மொத்த XP',

            // Profile
            'profile-title': 'எனது விவரம்',
            'profile-level': 'நிலை',
            'edit-title': 'விவரங்களைத் திருத்து',
            'badges-title': 'பெற்ற பேட்ஜ்கள்',
            'badge-rookie': 'ரூக்கி',
            'badge-elite': 'எலைட்',
            'badge-legend': 'லெஜண்ட்',
            'badge-top-tier': 'உயர்ந்த நிலை',

            // Tests
            'test-select-title': 'செயல்திறன் சோதனையைத் தேர்ந்தெடுக்கவும்',
            'test-pushups-title': 'புஷ்-அப்ஸ் (60 வினாடிகளில் அதிகபட்சம்)',
            'test-pushups-desc': 'தசை சகிப்புத்தன்மையை அளவிடுகிறது.',
            'test-sprint-title': '40மீ ஸ்பிரிண்ட்',
            'test-sprint-desc': 'அதிகபட்ச வேகம் மற்றும் முடுக்கத்தை அளவிடுகிறது.',
            'test-jump-title': 'செங்குத்து தாண்டுதல்',
            'test-jump-desc': 'வெடிக்கும் குதிக்கும் திறனை அளவிடுகிறது.',
            'test-plank-title': 'பிளாங்',
            'test-plank-desc': 'மைய வலிமை மற்றும் ஸ்திரத்தன்மையை அளவிடுகிறது.',

            // Submission
            'submit-title': 'சமர்ப்பி',
            'instructions-title': 'வழிமுறைகள்',
            'record-video-btn': 'நேரடி வீடியோவை பதிவுசெய்',
            'upload-file-btn': 'சாதனத்திலிருந்து பதிவேற்று',
            'submit-video-btn': 'மதிப்பாய்வுக்காக வீடியோவைச் சமர்ப்பி',

            // Record
            'record-title': 'வீடியோவை பதிவுசெய்',
            'camera-error-message': 'கேமரா அணுகல் மறுக்கப்பட்டது அல்லது கிடைக்கவில்லை. அனுமதிகளை சரிபார்க்கவும்.',
            'start-record-btn': 'பதிவு செய் தொடங்கவும்',
            'stop-record-btn': 'பதிவு செய் நிறுத்தவும்',
            'recording-status': 'பதிவு செய்யத் தயார்...',
            'record-in-progress': 'பதிவுசெய்து வருகிறது...',
            'record-finished': 'பதிவு முடிந்தது. சமர்ப்பிக்க தயார்.',

            // Upload
            'upload-title': 'வீடியோவைப் பதிவேற்று',
            'choose-file-btn': 'வீடியோ கோப்பைத் தேர்ந்தெடு',
            'no-video-selected': 'முன்னோட்டத்திற்காக வீடியோ எதுவும் தேர்ந்தெடுக்கப்படவில்லை.',

            // Info
            'info-title': 'பற்றி & கொள்கை',
            'about-app': 'TalentTrack Pro பற்றி',
            'about-body': 'TalentTrack Pro என்பது **இந்திய விளையாட்டு ஆணையத்தின் (SAI)** ஒரு அதிகாரப்பூர்வ கருவியாகும், இது தடகள செயல்திறன் கண்காணிப்பு மற்றும் திறமை அடையாளத்தை ஜனநாயகப்படுத்தும் வகையில் வடிவமைக்கப்பட்டுள்ளது. இது நாடு தழுவிய விளையாட்டுத் திறமை தரவுத்தளத்தை உருவாக்குவதை நோக்கமாகக் கொண்டுள்ளது, அதன் இருப்பிடத்தைப் பொருட்படுத்தாமல் எந்தவொரு தகுதியான தடகள வீரரும் கவனிக்கப்படாமல் இருப்பதை உறுதி செய்கிறது.',
            'policy-title': 'நியாயமான விளையாட்டு கொள்கை',
            'policy-point-1': 'அனைத்து சோதனை சமர்ப்பிப்புகளும் உண்மையான, திருத்தப்படாத வீடியோக்களாக இருக்க வேண்டும்.',
            'policy-point-2': 'இந்த தளம் முரண்பாடுகள் மற்றும் சாத்தியமான ஏமாற்று வேலைகளைக் கண்டறிய **AI-இயங்கும் வீடியோ பகுப்பாய்வைப்** பயன்படுத்துகிறது.',
            'policy-point-3': 'மோசடியானதாகக் கண்டறியப்பட்ட எந்தவொரு சமர்ப்பிப்பும் உடனடியாக நிராகரிக்கப்படும் மற்றும் சுயவிவரத்தை நிறுத்தி வைக்க வழிவகுக்கும்.',
            'policy-point-4': 'XP வழங்குவதற்கு முன் சான்றளிக்கப்பட்ட SAI பயிற்சியாளர்களால் மதிப்பெண்கள் மதிப்பாய்வு செய்யப்படுகின்றன.',
        },
        hi: {
            // General
            'edit-btn': 'संपादित करें',
            'save-btn': 'परिवर्तन सहेजें',
            'cancel-btn': 'रद्द करें',
            'logout-btn': 'लॉग आउट',
            'submission-success': 'सफलतापूर्वक जमा किया गया! समीक्षा की प्रतीक्षा है।',
            'not-a-video': 'चुनी गई फ़ाइल वीडियो नहीं है।',
            'file-selected': 'फ़ाइल चुनी गई',
            'no-file-selected': 'कोई फ़ाइल नहीं चुनी गई।',
            
            // Auth
            'auth-welcome': 'स्वागत है एथलीट',
            'auth-subtitle': 'अपनी यात्रा शुरू करने के लिए लॉग इन करें या रजिस्टर करें।',
            'login-btn': 'लॉग इन करें',
            'register-btn': 'रजिस्टर करें',
            'toggle-register': 'खाता नहीं है? रजिस्टर करें',
            'toggle-login': 'पहले से ही खाता है? लॉग इन करें',
            'email-placeholder': 'ईमेल',
            'password-placeholder': 'पासवर्ड',
            'name-placeholder': 'पूरा नाम',
            'age-placeholder': 'आयु',
            'aadhaar-placeholder': 'आधार (अंतिम 4)',
            'phone-placeholder': 'फ़ोन नंबर',
            'sport-placeholder': 'प्राथमिक खेल चुनें',
            'state-placeholder': 'राज्य चुनें',
            'religion-placeholder': 'धर्म चुनें',
            'sport-athletics': 'एथलेटिक्स',
            'sport-swimming': 'तैराकी',
            'sport-archery': 'तीरंदाजी',
            'sport-boxing': 'मुक्केबाजी',
            'sport-football': 'फुटबॉल',
            'sport-basketball': 'बास्केटबॉल',

            // Navigation
            'nav-home': 'होम',
            'nav-activity': 'गतिविधि',
            'nav-leaderboard': 'लीडरबोर्ड',
            'nav-info': 'जानकारी',

            // Home
            'home-welcome': 'वापस स्वागत है,',
            'xp-title': 'अनुभव अंक (XP)',
            'start-test-btn': 'नया टेस्ट शुरू करें',
            'missions-title': 'दैनिक लक्ष्य',
            'mission-speed': 'स्पीड डेमॉन: आज एक 40 मीटर स्प्रिंट टेस्ट पूरा करें।',
            'mission-plank': 'आयरन कोर: 120 सेकंड या उससे अधिक का प्लैंक समय प्राप्त करें।',

            // Activity
            'activity-title': 'गतिविधि और सबमिशन',
            'refresh-btn': 'स्थिति ताज़ा करें',
            'no-activity': 'कोई गतिविधि दर्ज नहीं की गई है।',
            'submission-submitted-on': 'जमा किया गया',
            'submission-score': 'स्कोर',
            'submission-xpearned': 'XP अर्जित',
            'submission-pending-text': 'कोच समीक्षा की प्रतीक्षा कर रहा है।',
            'submission-rejected-text': 'वीडियो अस्वीकार कर दिया गया',
            'submission-feedback': 'प्रतिक्रिया',
            'status-pending': 'लंबित',
            'status-approved': 'स्वीकृत',
            'status-rejected': 'अस्वीकृत',

            // Leaderboard
            'leaderboard-title': 'लीडरबोर्ड',
            'leaderboard-district': 'जिला',
            'leaderboard-state': 'राज्य',
            'leaderboard-national': 'राष्ट्रीय',
            'leaderboard-myrank': 'आपकी रैंक',
            'leaderboard-xp': 'कुल XP',

            // Profile
            'profile-title': 'मेरा प्रोफ़ाइल',
            'profile-level': 'स्तर',
            'edit-title': 'विवरण संपादित करें',
            'badges-title': 'अर्जित बैज',
            'badge-rookie': 'रूकी',
            'badge-elite': 'एलीट',
            'badge-legend': 'लीजेंड',
            'badge-top-tier': 'शीर्ष स्तर',

            // Tests
            'test-select-title': 'प्रदर्शन टेस्ट चुनें',
            'test-pushups-title': 'पुश-अप्स (60 सेकंड में अधिकतम)',
            'test-pushups-desc': 'मांसपेशियों की सहनशक्ति को मापता है।',
            'test-sprint-title': '40 मीटर स्प्रिंट',
            'test-sprint-desc': 'अधिकतम गति और त्वरण को मापता है।',
            'test-jump-title': 'वर्टिकल जंप',
            'test-jump-desc': 'विस्फोटक कूदने की क्षमता को मापता है।',
            'test-plank-title': 'प्लैंक',
            'test-plank-desc': 'कोर शक्ति और स्थिरता को मापता है।',

            // Submission
            'submit-title': 'जमा करें',
            'instructions-title': 'निर्देश',
            'record-video-btn': 'लाइव वीडियो रिकॉर्ड करें',
            'upload-file-btn': 'डिवाइस से अपलोड करें',
            'submit-video-btn': 'समीक्षा के लिए वीडियो जमा करें',

            // Record
            'record-title': 'वीडियो रिकॉर्ड करें',
            'camera-error-message': 'कैमरा पहुंच अस्वीकृत या उपलब्ध नहीं है। कृपया अनुमतियां जांचें।',
            'start-record-btn': 'रिकॉर्ड शुरू करें',
            'stop-record-btn': 'रिकॉर्ड बंद करें',
            'recording-status': 'रिकॉर्ड करने के लिए तैयार...',
            'record-in-progress': 'रिकॉर्डिंग हो रही है...',
            'record-finished': 'रिकॉर्डिंग समाप्त। जमा करने के लिए तैयार।',

            // Upload
            'upload-title': 'वीडियो अपलोड करें',
            'choose-file-btn': 'वीडियो फ़ाइल चुनें',
            'no-video-selected': 'पूर्वावलोकन के लिए कोई वीडियो नहीं चुना गया।',

            // Info
            'info-title': 'बारे में और नीति',
            'about-app': 'TalentTrack Pro के बारे में',
            'about-body': 'TalentTrack Pro **भारतीय खेल प्राधिकरण (SAI)** का एक आधिकारिक उपकरण है जिसे एथलीट प्रदर्शन ट्रैकिंग और प्रतिभा पहचान को लोकतांत्रिक बनाने के लिए डिज़ाइन किया गया है। इसका उद्देश्य खेल प्रतिभा का राष्ट्रव्यापी डेटाबेस बनाना है, यह सुनिश्चित करना कि उनके स्थान की परवाह किए बिना कोई भी योग्य एथलीट छूट न जाए।',
            'policy-title': 'निष्पक्ष खेल नीति',
            'policy-point-1': 'सभी टेस्ट सबमिशन प्रामाणिक, असंपदित वीडियो के रूप में होने चाहिए।',
            'policy-point-2': 'यह प्लेटफ़ॉर्म विसंगतियों और संभावित धोखाधड़ी का पता लगाने के लिए **एआई-संचालित वीडियो विश्लेषण** का उपयोग करता है।',
            'policy-point-3': 'धोखाधड़ी पाए जाने पर किसी भी सबमिशन को तुरंत अस्वीकार कर दिया जाएगा और प्रोफ़ाइल को निलंबित किया जा सकता है।',
            'policy-point-4': 'XP दिए जाने से पहले प्रमाणित SAI कोचों द्वारा स्कोर की समीक्षा की जाती है।',
        }
    };

    // --- LANGUAGE SWITCHER ---
    window.setLanguage = (lang) => {
        state.language = lang;
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            el.textContent = translations[lang][key] || el.textContent;
        });

        document.querySelectorAll('[data-translate-title]').forEach(el => {
            const key = el.getAttribute('data-translate-title');
            el.title = translations[lang][key] || el.title;
        });

        document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
            const key = el.getAttribute('data-translate-placeholder');
            const translatePlaceholder = translations[lang][key];
            el.placeholder = translations[lang][key] || el.placeholder;
        });

        // Ensure both language selects are updated
        document.getElementById('language-select-auth').value = lang;
        saveToLocalStorage(LANGUAGE_KEY, lang);
    };

    // --- INITIALIZATION ---
    window.addEventListener('popstate', (event) => {
        const pageId = (event.state && event.state.page) || 'auth-page';
        navigateTo(pageId, false);
    });
    
    // Attach event listener for the refresh button
    document.getElementById('refreshStatusBtn').addEventListener('click', () => {
        // The click handler is already defined on the window object above for direct access
        // We ensure the window function is called when the button is clicked.
    });


    const initializeMockData = () => {
         // Initialize mock users if none exist
         const users = getFromLocalStorage(USERS_KEY);
         if (!users || Object.keys(users).length === 0) {
             const mockUser = {
                 name: "Aarav Sharma",
                 email: "test@sai.in",
                 password: "password",
                 age: 19,
                 sport: "athletics",
                 state: "maharashtra",
                 religion: "hinduism",
                 aadhaar: "1234",
                 phone: "9876543210",
                 xp: 350,
                 level: 4,
                 profilePic: 'https://i.pravatar.cc/150?img=60'
             };
             const mockUsers = {
                 [mockUser.email]: mockUser
             };
             saveToLocalStorage(USERS_KEY, mockUsers);
             saveToLocalStorage(`submissions_${mockUser.email}`, [
                 { id: 1, testId: '40m-sprint', testName: translations.en['test-sprint-title'], date: '2024-05-15', status: 'APPROVED', score: 4.8, xpEarned: 150, feedback: 'Excellent form and effort!' },
                 { id: 2, testId: 'pushups', testName: translations.en['test-pushups-title'], date: '2024-05-10', status: 'PENDING', score: null, xpEarned: 0, feedback: '' },
                 { id: 3, testId: 'vertical-jump', testName: translations.en['test-jump-title'], date: '2024-05-01', status: 'REJECTED', score: 0, xpEarned: 0, feedback: 'Inconsistent starting form.' }
             ]);
         }
         mockAllUsers(); // Ensure leaderboard has mock data
     };

     const init = () => { 
        const savedLang = getFromLocalStorage(LANGUAGE_KEY, 'en');
        setLanguage(savedLang);
        initializeMockData(); 
        const loggedInUser = getFromLocalStorage(CURRENT_USER_KEY); 
        
        // Timeout to show splash screen (1.5 seconds)
        setTimeout(() => { 
            if (loggedInUser) { 
                state.currentUser = loggedInUser; 
                state.userSubmissions = getFromLocalStorage(`submissions_${loggedInUser.email}`, []); 
                const initialPage = window.location.hash.substring(1) || 'home-page'; 
                navigateTo(initialPage, false); 
            } else { 
                navigateTo('auth-page', false); 
            } 
            // Replace history state to set the initial URL hash correctly
            history.replaceState({ page: state.currentPage }, '', `#${state.currentPage}`); 
        }, 1500); 
    };
    
    // Initialize application
    init();

    // Attach event listeners for the leaderboard scope buttons
    document.querySelectorAll('.leaderboard-scope-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const scope = e.currentTarget.dataset.scope;
            changeLeaderboard(scope);
        });
    });
});