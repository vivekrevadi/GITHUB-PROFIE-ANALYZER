// Application State
const state = {
    activeTab: 'analyze', // 'analyze' or 'compare'
    token: localStorage.getItem('github_pat') || '',
    cache: new Map(), // simple in-memory cache
    charts: {
        languages: null
    },
    activeUser: null // stores the currently viewed user data
};

// GitHub API Constants
const BASE_URL = 'https://api.github.com';

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
    // Load and Apply Theme from localStorage
    const savedTheme = localStorage.getItem('gexplorer_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        updateThemeIcon(true);
    }

    // Initialize Lucide icons
    lucide.createIcons();
    
    // Set up Token Input in Settings Modal
    document.getElementById('patInput').value = state.token;
    
    // Check API Rate Limit on startup
    updateRateLimitStatus();
    
    // Setup Settings Modal events
    const settingsBtnMenu = document.getElementById('btnSettingsMenu');
    const modal = document.getElementById('settingsModal');
    const closeModalBtn = document.getElementById('btnLocalCloseModal');
    
    settingsBtnMenu.addEventListener('click', () => {
        modal.classList.remove('hidden');
        updateRateLimitStatus();
    });
    
    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Developer Console - Micro Latency Fluctuations
    const latencyEl = document.getElementById('consoleLatency');
    if (latencyEl) {
        setInterval(() => {
            const currentLatency = Math.floor(Math.random() * 8) + 8; // 8 - 15ms
            latencyEl.textContent = `${currentLatency}ms`;
        }, 3000);
    }
});

// Toggle Light/Dark Theme
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('gexplorer_theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (sunIcon && moonIcon) {
        if (isDark) {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    }
}

// Toggle Mobile Sidebar Drawer
function toggleMobileSidebar() {
    document.body.classList.toggle('sidebar-open');
}

// Switch Tab Navigation
function switchTab(tabName) {
    state.activeTab = tabName;
    
    const tabAnalyze = document.getElementById('tabAnalyze');
    const tabCompare = document.getElementById('tabCompare');
    const sectionWelcome = document.getElementById('sectionWelcome');
    const sectionDashboard = document.getElementById('sectionDashboard');
    const sectionCompare = document.getElementById('sectionCompare');
    const topSearchBar = document.getElementById('topSearchBarContainer');
    
    // Reset views
    sectionWelcome.classList.add('hidden');
    sectionDashboard.classList.add('hidden');
    sectionCompare.classList.add('hidden');
    
    tabAnalyze.classList.remove('active');
    tabCompare.classList.remove('active');
    
    if (tabName === 'analyze') {
        tabAnalyze.classList.add('active');
        if (topSearchBar) topSearchBar.style.visibility = 'visible';
        
        // Show dashboard if we already analyzed someone, otherwise welcome screen
        if (state.activeUser) {
            sectionDashboard.classList.remove('hidden');
        } else {
            sectionWelcome.classList.remove('hidden');
        }
        document.getElementById('usernameInput').value = '';
    } else {
        tabCompare.classList.add('active');
        if (topSearchBar) topSearchBar.style.visibility = 'hidden';
        sectionCompare.classList.remove('hidden');
        document.getElementById('compareUserA').value = '';
        document.getElementById('compareUserB').value = '';
        document.getElementById('compareResult').classList.add('hidden');
    }
}

// Reset view back to Welcome screen
function resetView() {
    state.activeUser = null;
    document.getElementById('sectionDashboard').classList.add('hidden');
    document.getElementById('sectionWelcome').classList.remove('hidden');
    
    // Reset sidebar user widget to default
    document.getElementById('sidebarUserAvatar').src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    document.getElementById('sidebarUserName').textContent = 'Search User';
    document.getElementById('sidebarUserLogin').textContent = '@github';
    
    // Reset timeline empty state
    const activityTimeline = document.getElementById('activityTimeline');
    if (activityTimeline) {
        activityTimeline.innerHTML = '<p class="timeline-empty">Search a profile to start the analysis feed.</p>';
    }
    document.getElementById('badgesContainer').innerHTML = '<p class="timeline-empty">Search a profile to view earned achievements.</p>';
}

// Dismiss Error Message
function dismissError() {
    document.getElementById('errorMessage').classList.add('hidden');
    if (state.activeTab === 'analyze') {
        if (state.activeUser) {
            document.getElementById('sectionDashboard').classList.remove('hidden');
        } else {
            document.getElementById('sectionWelcome').classList.remove('hidden');
        }
    } else {
        document.getElementById('sectionCompare').classList.remove('hidden');
    }
}

// Show Error Screen
function showError(title, description) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('compareLoader').classList.add('hidden');
    
    const errorEl = document.getElementById('errorMessage');
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorDescription').textContent = description;
    
    errorEl.classList.remove('hidden');
    
    // Hide main views
    document.getElementById('sectionWelcome').classList.add('hidden');
    document.getElementById('sectionDashboard').classList.add('hidden');
    if (state.activeTab === 'compare') {
        document.getElementById('sectionCompare').classList.add('hidden');
    }
}

// Trigger Search from Quick Links / Pills
function triggerQuickSearch(username) {
    document.getElementById('usernameInput').value = username;
    performAnalysis(username);
}

// Search Submission
function handleSearchSubmit(event) {
    event.preventDefault();
    const username = document.getElementById('usernameInput').value.trim();
    if (username) {
        performAnalysis(username);
    }
}

// Fetch helper with API Rate Limit Header hooks
async function fetchGitHub(endpoint) {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    
    const headers = {
        'Accept': 'application/vnd.github.v3+json'
    };
    
    if (state.token) {
        headers['Authorization'] = `token ${state.token}`;
    }
    
    const response = await fetch(url, { headers });
    
    // Update API limit indicators
    const limit = response.headers.get('x-ratelimit-limit');
    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetTime = response.headers.get('x-ratelimit-reset');
    
    if (limit && remaining) {
        updateRateLimitUI(parseInt(limit), parseInt(remaining), parseInt(resetTime));
    }
    
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('User not found');
        } else if (response.status === 403) {
            throw new Error('API limit exceeded. Please configure a Personal Access Token.');
        } else {
            throw new Error(`GitHub API Error: ${response.statusText}`);
        }
    }
    
    return await response.json();
}

// Update Rate Limit Info Globally
async function updateRateLimitStatus() {
    try {
        const data = await fetchGitHub('/rate_limit');
        const core = data.resources.core;
        updateRateLimitUI(core.limit, core.remaining, core.reset);
    } catch (err) {
        console.error('Failed to get rate limit status', err);
    }
}

function updateRateLimitUI(limit, remaining, resetTime) {
    // Update Live Feed Header Badge
    const liveFeedRemaining = document.getElementById('liveFeedApiRemaining');
    if (liveFeedRemaining) {
        liveFeedRemaining.textContent = `API: ${remaining} left`;
        
        // Dynamic pastel color adjustments based on remaining limits
        liveFeedRemaining.className = 'api-remaining-indicator';
        const pct = remaining / limit;
        if (pct < 0.1) {
            liveFeedRemaining.style.backgroundColor = 'var(--pastel-red-bg)';
            liveFeedRemaining.style.color = 'var(--pastel-red-text)';
        } else if (pct < 0.3) {
            liveFeedRemaining.style.backgroundColor = 'var(--pastel-yellow-bg)';
            liveFeedRemaining.style.color = 'var(--pastel-yellow-text)';
        } else {
            // Restore default themed colors
            liveFeedRemaining.removeAttribute('style');
        }
    }
    
    // Modal updates
    const modalLimit = document.getElementById('modalLimitVal');
    const modalRemaining = document.getElementById('modalRemainingVal');
    const modalReset = document.getElementById('modalResetVal');
    
    if (modalLimit && modalRemaining && modalReset) {
        modalLimit.textContent = limit;
        modalRemaining.textContent = remaining;
        
        const resetDate = new Date(resetTime * 1000);
        modalReset.textContent = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Cache Fetch Wrapper (Prevents duplicate API calls in-session)
async function getCachedUserData(username) {
    const key = username.toLowerCase();
    if (state.cache.has(key)) {
        return state.cache.get(key);
    }
    
    // Fetch profile
    const profile = await fetchGitHub(`/users/${username}`);
    
    // Fetch Repositories (First 100 public repos)
    const repos = await fetchGitHub(`/users/${username}/repos?per_page=100&sort=updated`);
    
    const userData = { profile, repos };
    state.cache.set(key, userData);
    return userData;
}

// Perform Profile Analysis
async function performAnalysis(username) {
    // Hide forms/welcome, show loader
    document.getElementById('sectionWelcome').classList.add('hidden');
    document.getElementById('sectionDashboard').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    
    try {
        const { profile, repos } = await getCachedUserData(username);
        
        // Calculate Analytics
        const analytics = calculateAnalytics(profile, repos);
        
        // Update state active user
        state.activeUser = { profile, repos, analytics };
        
        // Render to UI
        renderDashboard(profile, repos, analytics);
        
        // Hide loader, show dashboard
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('sectionDashboard').classList.remove('hidden');
        
        // Re-trigger icon updates
        lucide.createIcons();
        
    } catch (err) {
        showError(err.message === 'User not found' ? 'Developer Not Found' : 'Analysis Failed', err.message);
    }
}

// Analytics engine
function calculateAnalytics(profile, repos) {
    const totalRepos = profile.public_repos;
    let totalStars = 0;
    let totalForks = 0;
    let openIssues = 0;
    const languagesMap = {};
    
    // Summarize repo values
    repos.forEach(repo => {
        totalStars += repo.stargazers_count;
        totalForks += repo.forks_count;
        openIssues += repo.open_issues_count;
        
        if (repo.language) {
            languagesMap[repo.language] = (languagesMap[repo.language] || 0) + 1;
        }
    });
    
    // Average values
    const analyzedCount = repos.length;
    const avgStars = analyzedCount > 0 ? (totalStars / analyzedCount).toFixed(1) : '0.0';
    const avgForks = analyzedCount > 0 ? (totalForks / analyzedCount).toFixed(1) : '0.0';
    
    // Language distribution sorted
    const languages = Object.entries(languagesMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    
    const primaryLanguage = languages.length > 0 ? languages[0].name : 'None Specified';
    
    // Calculation of Profile Score (0 - 100)
    // Followers component (Max 30): Log base scale
    const followers = profile.followers;
    const followerScore = Math.min(30, (Math.log10(followers + 1) / 3.5) * 30);
    
    // Stars component (Max 30): Log base scale
    const starsScore = Math.min(30, (Math.log10(totalStars + 1) / 3.5) * 30);
    
    // Forks component (Max 20): Log base scale
    const forksScore = Math.min(20, (Math.log10(totalForks + 1) / 3.0) * 20);
    
    // Repository Count component (Max 20): Linear scaled to 50 repos
    const repoScore = Math.min(20, (Math.min(totalRepos, 50) / 50) * 20);
    
    const finalScore = Math.round(followerScore + starsScore + forksScore + repoScore);
    const rankFactors = [
        { label: 'Followers', value: Math.round(followerScore), max: 30 },
        { label: 'Stars', value: Math.round(starsScore), max: 30 },
        { label: 'Forks', value: Math.round(forksScore), max: 20 },
        { label: 'Repositories', value: Math.round(repoScore), max: 20 }
    ];
    
    // Compute Rank
    let rank = 'E';
    let rankExplanation = 'Early Explorer. Start building repositories and sharing your code to rank up!';
    
    if (finalScore >= 90) {
        rank = 'S';
        rankExplanation = 'God-Tier Developer! Extraordinary community presence, massive stars, and immense utility.';
    } else if (finalScore >= 75) {
        rank = 'A';
        rankExplanation = 'Elite Architect. Highly active developer with popular, community-trusted repositories.';
    } else if (finalScore >= 60) {
        rank = 'B';
        rankExplanation = 'Senior Contributor. Strong skillset, solid project portfolio, and steady follower base.';
    } else if (finalScore >= 45) {
        rank = 'C';
        rankExplanation = 'Active Builder. Regularly developing code and showing good initial traction.';
    } else if (finalScore >= 30) {
        rank = 'D';
        rankExplanation = 'Rising Innovator. Has published projects and starting to explore Git ecosystems.';
    }
    
    // Compute Achievement Badges
    const badges = [];
    const joinedYear = new Date(profile.created_at).getFullYear();
    const currentYear = new Date().getFullYear();
    const yearsOnGit = currentYear - joinedYear;
    
    if (languages.length >= 5) {
        badges.push({
            name: 'Polyglot Polymath',
            desc: `Mastered ${languages.length} programming languages`,
            icon: 'code-2',
            color: 'purple'
        });
    }
    if (totalStars >= 1000) {
        badges.push({
            name: 'Superstar Creator',
            desc: `Gained over 1,000+ repo stars`,
            icon: 'award',
            color: 'yellow'
        });
    } else if (totalStars >= 100) {
        badges.push({
            name: 'Star Collector',
            desc: `Accumulated 100+ repository stars`,
            icon: 'star',
            color: 'yellow'
        });
    }
    if (totalForks >= 50) {
        badges.push({
            name: 'Fork Legend',
            desc: 'Code replicated 50+ times globally',
            icon: 'git-fork',
            color: 'green'
        });
    }
    if (totalRepos >= 50) {
        badges.push({
            name: 'Code Machine',
            desc: 'Published 50+ public repositories',
            icon: 'cpu',
            color: 'blue'
        });
    }
    if (yearsOnGit >= 5) {
        badges.push({
            name: 'Open Source Veteran',
            desc: `Contributing for ${yearsOnGit} years`,
            icon: 'calendar',
            color: 'cyan'
        });
    }
    if (followers >= 100) {
        badges.push({
            name: 'Community Beacon',
            desc: `${followers} developers following them`,
            icon: 'users',
            color: 'blue'
        });
    }
    if (parseFloat(avgStars) >= 15 && totalStars > 50) {
        badges.push({
            name: 'Quality Catalyst',
            desc: 'Averages over 15 stars per repo',
            icon: 'sparkles',
            color: 'purple'
        });
    }
    
    // Default badge for new accounts
    if (badges.length === 0) {
        badges.push({
            name: 'Genesis Pilot',
            desc: 'Initiating first operations on GitHub',
            icon: 'compass',
            color: 'cyan'
        });
    }

    const activityEvents = [
        {
            icon: 'search-check',
            color: 'cyan',
            title: 'Profile fetched',
            desc: `Loaded public GitHub profile for @${profile.login}`
        },
        {
            icon: 'folder-search',
            color: 'green',
            title: 'Repositories scanned',
            desc: `Analyzed ${analyzedCount} recently updated repositories`
        },
        {
            icon: 'bar-chart-3',
            color: 'purple',
            title: 'Score calculated',
            desc: `Rank ${rank} with ${finalScore}/100 overall score`
        },
        {
            icon: 'code-2',
            color: 'yellow',
            title: 'Primary stack detected',
            desc: primaryLanguage === 'None Specified' ? 'No dominant language found yet' : `${primaryLanguage} leads this profile`
        },
        {
            icon: 'badge-check',
            color: 'blue',
            title: 'Achievements unlocked',
            desc: `${badges.length} achievement${badges.length === 1 ? '' : 's'} ready in the feed`
        }
    ];
    
    // Sum sizes & calculate hour activity distribution
    let totalSizeKB = 0;
    let morning = 0, afternoon = 0, evening = 0, night = 0;
    
    repos.forEach(repo => {
        totalSizeKB += repo.size || 0;
        const date = new Date(repo.updated_at || repo.pushed_at);
        const hour = date.getHours();
        if (hour >= 6 && hour < 12) morning++;
        else if (hour >= 12 && hour < 18) afternoon++;
        else if (hour >= 18 && hour < 24) evening++;
        else night++;
    });
    
    let archetype = 'Generalist 💻';
    if (repos.length > 0) {
        const max = Math.max(morning, afternoon, evening, night);
        if (max === morning) archetype = 'Early Bird 🌅';
        else if (max === afternoon) archetype = 'Daylight Runner ☀️';
        else if (max === evening) archetype = 'Sunset Coder 🌇';
        else archetype = 'Night Owl 🦉';
    }

    return {
        totalStars,
        totalForks,
        openIssues,
        avgStars,
        avgForks,
        languages,
        primaryLanguage,
        score: finalScore,
        rank,
        rankExplanation,
        rankFactors,
        badges,
        activityEvents,
        totalSizeKB,
        archetype
    };
}

// Render Dashboard Data
function renderDashboard(profile, repos, analytics) {
    // Reset Repo Filter Input
    const filterInput = document.getElementById('repoFilterInput');
    if (filterInput) filterInput.value = '';
    document.getElementById('reposListedCount').textContent = 'Showing Top 5';

    // Update Left Sidebar User Widget
    document.getElementById('sidebarUserAvatar').src = profile.avatar_url;
    document.getElementById('sidebarUserName').textContent = profile.name || profile.login;
    document.getElementById('sidebarUserLogin').textContent = `@${profile.login}`;

    // Profile Details Header Card
    document.getElementById('userAvatar').src = profile.avatar_url;
    document.getElementById('userName').textContent = profile.name || profile.login;
    document.getElementById('userLogin').textContent = `@${profile.login}`;
    
    // Bio
    const bioEl = document.getElementById('userBio');
    if (profile.bio) {
        bioEl.textContent = profile.bio;
        bioEl.classList.remove('hidden');
    } else {
        bioEl.textContent = 'This developer has no bio.';
    }
    
    // Details Grid items
    toggleDetail('detailCompany', 'userCompany', profile.company);
    toggleDetail('detailLocation', 'userLocation', profile.location);
    
    const blogEl = document.getElementById('detailBlog');
    if (profile.blog) {
        const link = profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`;
        document.getElementById('userBlog').href = link;
        document.getElementById('userBlog').textContent = profile.blog.replace(/(^\w+:|^)\/\//, '');
        blogEl.classList.remove('hidden');
    } else {
        blogEl.classList.add('hidden');
    }
    
    const joinedDate = new Date(profile.created_at);
    document.getElementById('userJoined').textContent = `Joined ${joinedDate.toLocaleDateString([], { month: 'short', year: 'numeric' })}`;
    
    // Rank & Score Card
    document.getElementById('rankBadge').textContent = analytics.rank;
    document.getElementById('rankScore').textContent = `${analytics.score}/100`;
    document.getElementById('scoreBar').style.width = `${analytics.score}%`;
    document.getElementById('rankExplanation').textContent = analytics.rankExplanation;

    const rankFactorList = document.getElementById('rankFactorList');
    if (rankFactorList) {
        rankFactorList.innerHTML = '';
        analytics.rankFactors.forEach(factor => {
            const row = document.createElement('div');
            row.className = 'rank-factor-row';
            row.innerHTML = `
                <span>${factor.label}</span>
                <strong>${factor.value}/${factor.max}</strong>
            `;
            rankFactorList.appendChild(row);
        });
    }

    const activityTimeline = document.getElementById('activityTimeline');
    if (activityTimeline) {
        activityTimeline.innerHTML = '';
        analytics.activityEvents.forEach(event => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="badge-icon-wrap ${event.color}">
                    <i data-lucide="${event.icon}"></i>
                </div>
                <div class="badge-text">
                    <span class="badge-name">${event.title}</span>
                    <span class="badge-desc">${event.desc}</span>
                </div>
            `;
            activityTimeline.appendChild(item);
        });
    }
    
    // Render Badges in Right Sidebar
    const badgeContainer = document.getElementById('badgesContainer');
    badgeContainer.innerHTML = '';
    
    analytics.badges.forEach(badge => {
        const item = document.createElement('div');
        item.className = 'badge-item';
        item.innerHTML = `
            <div class="badge-icon-wrap ${badge.color}">
                <i data-lucide="${badge.icon}"></i>
            </div>
            <div class="badge-text">
                <span class="badge-name">${badge.name}</span>
                <span class="badge-desc">${badge.desc}</span>
            </div>
        `;
        badgeContainer.appendChild(item);
    });
    
    // Pastel Summary Grid metrics
    document.getElementById('statRepos').textContent = profile.public_repos;
    document.getElementById('statStars').textContent = analytics.totalStars;
    document.getElementById('statForks').textContent = analytics.totalForks;
    document.getElementById('statFollowers').textContent = profile.followers;
    
    // Summary table / metrics under chart
    document.getElementById('valAvgStars').textContent = analytics.avgStars;
    document.getElementById('valAvgForks').textContent = analytics.avgForks;
    document.getElementById('valPrimaryLanguage').textContent = analytics.primaryLanguage;
    
    // Format and set total size & archetype
    const sizeKB = analytics.totalSizeKB;
    let sizeText = `${sizeKB} KB`;
    if (sizeKB >= 1024 * 1024) {
        sizeText = `${(sizeKB / (1024 * 1024)).toFixed(1)} GB`;
    } else if (sizeKB >= 1024) {
        sizeText = `${(sizeKB / 1024).toFixed(1)} MB`;
    }
    document.getElementById('valTotalSize').textContent = sizeText;
    document.getElementById('valArchetype').textContent = analytics.archetype;
    
    // Render Charts
    renderLanguagesChart(analytics.languages);
    
    // Render Top Repositories List
    const reposList = document.getElementById('reposListContainer');
    reposList.innerHTML = '';
    
    // Sort repos by star count descending, take top 5
    const topRepos = [...repos]
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 5);
        
    if (topRepos.length === 0) {
        reposList.innerHTML = '<p class="loader-text" style="padding: 20px 0; grid-column: span 2;">No repositories found for this user.</p>';
    } else {
        topRepos.forEach(repo => {
            const item = document.createElement('div');
            item.className = 'repo-item';
            
            // Get language dot color
            const langDotColor = getLanguageColor(repo.language);
            
            item.innerHTML = `
                <div class="repo-title-row">
                    <a href="${repo.html_url}" target="_blank" class="repo-name">
                        <i data-lucide="folder"></i> ${repo.name}
                    </a>
                    <div class="repo-meta-right">
                        <span class="repo-stat-badge stars">
                            <i data-lucide="star"></i> ${repo.stargazers_count}
                        </span>
                        <span class="repo-stat-badge forks">
                            <i data-lucide="git-fork"></i> ${repo.forks_count}
                        </span>
                    </div>
                </div>
                <p class="repo-description">${repo.description || 'No description provided.'}</p>
                <div class="repo-footer">
                    ${repo.language ? `
                        <div class="repo-language-badge">
                            <span class="lang-dot" style="background-color: ${langDotColor};"></span>
                            <span>${repo.language}</span>
                        </div>
                    ` : '<div></div>'}
                    <span class="repo-size">${Math.round(repo.size / 1024 * 10) / 10} MB</span>
                </div>
            `;
            reposList.appendChild(item);
        });
    }
}

// Helper: Show/Hide Profile details
function toggleDetail(containerId, spanId, val) {
    const el = document.getElementById(containerId);
    if (val) {
        document.getElementById(spanId).textContent = val;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// Render Doughnut Chart for Languages
function renderLanguagesChart(languagesData) {
    const canvas = document.getElementById('languagesChart');
    
    // Clear old chart instance if existing to avoid overlapping rendering
    if (state.charts.languages) {
        state.charts.languages.destroy();
    }
    
    if (languagesData.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.font = '14px Plus Jakarta Sans';
        ctx.fillText('No language statistics available', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Keep top 5 languages, group rest into "Others"
    let chartLangs = languagesData.slice(0, 5);
    if (languagesData.length > 5) {
        const otherCount = languagesData.slice(5).reduce((sum, item) => sum + item.count, 0);
        chartLangs.push({ name: 'Others', count: otherCount });
    }
    
    const labels = chartLangs.map(l => l.name);
    const data = chartLangs.map(l => l.count);
    
    // Custom modern light dashboard colors (soft but distinct)
    const colors = [
        '#2563eb', // Blue
        '#10b981', // Green
        '#b45309', // Amber/Yellow
        '#7e22ce', // Purple
        '#06b6d4', // Cyan
        '#ec4899', // Pink
        '#9ca3af'  // Gray (for others)
    ];
    
    state.charts.languages = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, chartLangs.length),
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#4b5563',
                        font: {
                            family: 'Plus Jakarta Sans',
                            size: 10,
                            weight: '700'
                        },
                        padding: 8,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Plus Jakarta Sans', size: 11, weight: '700' },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
                    cornerRadius: 6
                }
            },
            cutout: '65%'
        }
    });
}

// GitHub Language color definitions helper
function getLanguageColor(lang) {
    if (!lang) return '#9ca3af';
    const colors = {
        'JavaScript': '#d9c612',
        'TypeScript': '#2563eb',
        'HTML': '#ea580c',
        'CSS': '#6d28d9',
        'Python': '#1d4ed8',
        'Go': '#0891b2',
        'Java': '#a16207',
        'Ruby': '#991b1b',
        'C++': '#be123c',
        'C#': '#15803d',
        'PHP': '#4338ca',
        'Rust': '#c2410c',
        'Shell': '#4d7c0f',
        'Swift': '#ea580c',
        'Kotlin': '#7c3aed',
        'C': '#4b5563'
    };
    return colors[lang] || '#2563eb';
}

// Profile Comparison Submit Logic
async function handleCompareSubmit(event) {
    event.preventDefault();
    const userA = document.getElementById('compareUserA').value.trim();
    const userB = document.getElementById('compareUserB').value.trim();
    
    if (!userA || !userB) return;
    if (userA.toLowerCase() === userB.toLowerCase()) {
        showError('Comparison Error', 'Please choose two different users to compare.');
        return;
    }
    
    const loader = document.getElementById('compareLoader');
    const resultContainer = document.getElementById('compareResult');
    
    loader.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    
    try {
        // Fetch both users concurrently
        const [dataA, dataB] = await Promise.all([
            getCachedUserData(userA),
            getCachedUserData(userB)
        ]);
        
        const analyticsA = calculateAnalytics(dataA.profile, dataA.repos);
        const analyticsB = calculateAnalytics(dataB.profile, dataB.repos);
        
        renderComparison(dataA.profile, analyticsA, dataB.profile, analyticsB);
        
        loader.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        
        lucide.createIcons();
    } catch (err) {
        showError('Comparison Failed', err.message);
    }
}

// Render Comparison results
function renderComparison(profA, analA, profB, analB) {
    // Head A
    document.getElementById('compAvatarA').src = profA.avatar_url;
    document.getElementById('compNameA').textContent = profA.name || profA.login;
    document.getElementById('compLoginA').textContent = `@${profA.login}`;
    document.getElementById('compBadgeA').textContent = analA.rank;
    
    // Head B
    document.getElementById('compAvatarB').src = profB.avatar_url;
    document.getElementById('compNameB').textContent = profB.name || profB.login;
    document.getElementById('compLoginB').textContent = `@${profB.login}`;
    document.getElementById('compBadgeB').textContent = analB.rank;
    
    // Stats elements compare row helper
    const renderCompRow = (idA, idB, valA, valB, formatFn = (x) => x) => {
        const elA = document.getElementById(idA);
        const elB = document.getElementById(idB);
        
        elA.textContent = formatFn(valA);
        elB.textContent = formatFn(valB);
        
        elA.classList.remove('win');
        elB.classList.remove('win');
        
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        
        if (numA > numB) {
            elA.classList.add('win');
        } else if (numB > numA) {
            elB.classList.add('win');
        }
    };
    
    renderCompRow('compScoreA', 'compScoreB', analA.score, analB.score);
    renderCompRow('compFollowersA', 'compFollowersB', profA.followers, profB.followers);
    renderCompRow('compReposA', 'compReposB', profA.public_repos, profB.public_repos);
    renderCompRow('compStarsA', 'compStarsB', analA.totalStars, analB.totalStars);
    renderCompRow('compForksA', 'compForksB', analA.totalForks, analB.totalForks);
    renderCompRow('compAvgStarsA', 'compAvgStarsB', analA.avgStars, analB.avgStars);
    renderCompRow('compBadgesCountA', 'compBadgesCountB', analA.badges.length, analB.badges.length);
    
    // Set head border glow to higher score user
    const headA = document.getElementById('compHeadA');
    const headB = document.getElementById('compHeadB');
    headA.classList.remove('better');
    headB.classList.remove('better');
    
    if (analA.score > analB.score) {
        headA.classList.add('better');
    } else if (analB.score > analA.score) {
        headB.classList.add('better');
    }
    
    // Declare Champion
    const winNameEl = document.getElementById('winnerName');
    const winReasonEl = document.getElementById('winnerReason');
    
    if (analA.score === analB.score) {
        winNameEl.textContent = 'Draw Match';
        winReasonEl.textContent = `Both developers have an equal global profile score of ${analA.score}/100!`;
    } else {
        const winner = analA.score > analB.score ? { prof: profA, anal: analA, other: profB } : { prof: profB, anal: analB, other: profA };
        winNameEl.textContent = winner.prof.name || winner.prof.login;
        
        let reason = `Outperforming ${winner.other.name || winner.other.login} with a higher profile score of ${winner.anal.score}/100`;
        if (winner.anal.totalStars > 1000) {
            reason += `, showing substantial community presence and highly-starred repositories.`;
        } else {
            reason += ` and unlocking ${winner.anal.badges.length} profile achievements.`;
        }
        winReasonEl.textContent = reason;
    }
}

// Token settings form operations
function saveSettings(event) {
    event.preventDefault();
    const token = document.getElementById('patInput').value.trim();
    
    if (token) {
        state.token = token;
        localStorage.setItem('github_pat', token);
    } else {
        clearToken();
    }
    
    // Hide modal and refresh limit status
    document.getElementById('settingsModal').classList.add('hidden');
    updateRateLimitStatus();
}

function clearToken() {
    state.token = '';
    localStorage.removeItem('github_pat');
    document.getElementById('patInput').value = '';
    
    // Refresh limits status
    updateRateLimitStatus();
}

// Filter Repositories by Name or Language in Real-time
function handleRepoFilter() {
    if (!state.activeUser) return;
    const filterText = document.getElementById('repoFilterInput').value.toLowerCase().trim();
    const reposList = document.getElementById('reposListContainer');
    reposList.innerHTML = '';
    
    const allRepos = state.activeUser.repos;
    
    // Filter repos
    const filtered = allRepos.filter(repo => {
        const nameMatch = repo.name.toLowerCase().includes(filterText);
        const langMatch = repo.language && repo.language.toLowerCase().includes(filterText);
        return nameMatch || langMatch;
    });
    
    // Sort and slice: if filter is empty, show top 5 starred. If active, show all matches sorted by stars.
    let toRender = [...filtered];
    if (!filterText) {
        toRender = toRender.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
        document.getElementById('reposListedCount').textContent = 'Showing Top 5';
    } else {
        toRender = toRender.sort((a, b) => b.stargazers_count - a.stargazers_count);
        document.getElementById('reposListedCount').textContent = `Found ${filtered.length} matches`;
    }
    
    if (toRender.length === 0) {
        reposList.innerHTML = '<p class="loader-text" style="padding: 20px 0; grid-column: span 2; text-align: center;">No matching repositories found.</p>';
    } else {
        toRender.forEach(repo => {
            const item = document.createElement('div');
            item.className = 'repo-item';
            const langDotColor = getLanguageColor(repo.language);
            item.innerHTML = `
                <div class="repo-title-row">
                    <a href="${repo.html_url}" target="_blank" class="repo-name">
                        <i data-lucide="folder"></i> ${repo.name}
                    </a>
                    <div class="repo-meta-right">
                        <span class="repo-stat-badge stars">
                            <i data-lucide="star"></i> ${repo.stargazers_count}
                        </span>
                        <span class="repo-stat-badge forks">
                            <i data-lucide="git-fork"></i> ${repo.forks_count}
                        </span>
                    </div>
                </div>
                <p class="repo-description">${repo.description || 'No description provided.'}</p>
                <div class="repo-footer">
                    ${repo.language ? `
                        <div class="repo-language-badge">
                            <span class="lang-dot" style="background-color: ${langDotColor};"></span>
                            <span>${repo.language}</span>
                        </div>
                    ` : '<div></div>'}
                    <span class="repo-size">${Math.round(repo.size / 1024 * 10) / 10} MB</span>
                </div>
            `;
            reposList.appendChild(item);
        });
    }
    lucide.createIcons();
}
