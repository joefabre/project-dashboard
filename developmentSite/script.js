// Status Dashboard JavaScript
class StatusDashboard {
    constructor() {
        this.projects = JSON.parse(localStorage.getItem('projects')) || [];
        this.currentEditId = null;
        this.charts = {};
        
        this.init();
    }

    init() {
        this.updateDateTime();
        this.checkNetworkStatus();
        this.setupEventListeners();
        this.renderProjects();
        this.startTicker();
        
        // Update date/time every second
        setInterval(() => this.updateDateTime(), 1000);
        
        // Check network status every 30 seconds
        setInterval(() => this.checkNetworkStatus(), 30000);
    }

    setupEventListeners() {
        // Modal controls
        const addBtn = document.getElementById('add-project-btn');
        const modal = document.getElementById('project-modal');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancel-btn');
        const form = document.getElementById('project-form');
        const helpBtn = document.getElementById('help-btn');
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const importFile = document.getElementById('import-file');

        addBtn.addEventListener('click', () => this.openModal());
        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        helpBtn.addEventListener('click', () => this.openHelp());
        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => this.importData());
        importFile.addEventListener('change', (e) => this.handleFileImport(e));
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProject();
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
        
    }

    openModal(projectId = null) {
        const modal = document.getElementById('project-modal');
        const modalTitle = document.getElementById('modal-title');
        const form = document.getElementById('project-form');
        
        this.currentEditId = projectId;
        
        // Populate dependencies dropdown
        this.populateDependenciesDropdown(projectId);
        
        if (projectId) {
            const project = this.projects.find(p => p.id === projectId);
            modalTitle.textContent = 'Edit Project';
            this.populateForm(project);
        } else {
            modalTitle.textContent = 'Add New Project';
            form.reset();
            document.getElementById('start-date').value = new Date().toISOString().split('T')[0];
        }
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('project-modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.currentEditId = null;
    }

    openHelp() {
        window.open('help.html', '_blank');
    }

    populateDependenciesDropdown(currentProjectId = null) {
        const dependenciesSelect = document.getElementById('project-dependencies');
        dependenciesSelect.innerHTML = '';
        
        // Get all projects except the current one being edited
        const availableProjects = this.projects.filter(p => p.id !== currentProjectId);
        
        if (availableProjects.length === 0) {
            dependenciesSelect.innerHTML = '<option disabled>No other projects available</option>';
            return;
        }
        
        availableProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.title} (${project.status.replace('-', ' ')})`;
            dependenciesSelect.appendChild(option);
        });
    }
    
    populateForm(project) {
        document.getElementById('project-title').value = project.title;
        document.getElementById('project-details').value = project.details;
        document.getElementById('start-date').value = project.startDate;
        document.getElementById('due-date').value = project.dueDate;
        document.getElementById('project-status').value = project.status;
        
        // Handle project dependencies
        const dependenciesSelect = document.getElementById('project-dependencies');
        const dependencies = project.dependencies || [];
        Array.from(dependenciesSelect.options).forEach(option => {
            option.selected = dependencies.includes(option.value);
        });
        
        // Handle project steps
        const steps = project.steps || [];
        const stepsText = steps.map(step => step.text).join('\n');
        document.getElementById('project-steps').value = stepsText;
    }

    saveProject() {
        const stepsText = document.getElementById('project-steps').value.trim();
        const steps = stepsText ? stepsText.split('\n').filter(step => step.trim()).map((step, index) => ({
            id: `step-${Date.now()}-${index}`,
            text: step.trim(),
            completed: false
        })) : [];
        
        // Get selected dependencies
        const dependenciesSelect = document.getElementById('project-dependencies');
        const dependencies = Array.from(dependenciesSelect.selectedOptions).map(option => option.value);
        
        const formData = {
            title: document.getElementById('project-title').value.trim(),
            details: document.getElementById('project-details').value.trim(),
            startDate: document.getElementById('start-date').value,
            dueDate: document.getElementById('due-date').value,
            status: document.getElementById('project-status').value,
            dependencies: dependencies,
            steps: steps,
            progress: 0 // Will be calculated from completed steps
        };

        if (!formData.title || !formData.startDate || !formData.dueDate) {
            alert('Please fill in all required fields.');
            return;
        }

        if (new Date(formData.startDate) > new Date(formData.dueDate)) {
            alert('Start date cannot be after due date.');
            return;
        }

        if (this.currentEditId) {
            // Edit existing project - preserve existing step completion status
            const projectIndex = this.projects.findIndex(p => p.id === this.currentEditId);
            const existingProject = this.projects[projectIndex];
            
            // If steps were modified, try to preserve completion status for existing steps
            if (existingProject.steps) {
                formData.steps = formData.steps.map(newStep => {
                    const existingStep = existingProject.steps.find(s => s.text === newStep.text);
                    return existingStep ? { ...newStep, completed: existingStep.completed } : newStep;
                });
            }
            
            // Calculate progress from completed steps
            formData.progress = this.calculateProgress(formData.steps);
            
            // Check if project was just marked as completed
            const wasCompleted = existingProject.status === 'completed';
            const isNowCompleted = formData.status === 'completed';
            
            this.projects[projectIndex] = { ...existingProject, ...formData };
            
            // Auto-archive if newly completed
            if (!wasCompleted && isNowCompleted) {
                this.archiveProject(this.projects[projectIndex].id);
                return; // archiveProject handles saving and rendering
            }
        } else {
            // Add new project
            const newProject = {
                id: Date.now().toString(),
                ...formData,
                createdAt: new Date().toISOString()
            };
            this.projects.push(newProject);
            
            // Auto-archive if created as completed
            if (formData.status === 'completed') {
                this.archiveProject(newProject.id);
                return; // archiveProject handles saving and rendering
            }
        }

        this.saveToStorage();
        this.renderProjects();
        this.closeModal();
        this.updateTickerStats();
    }

    deleteProject(projectId) {
        if (confirm('Are you sure you want to delete this project?')) {
            this.projects = this.projects.filter(p => p.id !== projectId);
            this.saveToStorage();
            this.renderProjects();
            this.updateTickerStats();
        }
    }
    
    archiveProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        // Add archival timestamp
        project.archivedAt = new Date().toISOString();
        
        // Get existing archived projects
        let archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
        
        // Add this project to archived
        archivedProjects.push(project);
        
        // Remove from active projects
        this.projects = this.projects.filter(p => p.id !== projectId);
        
        // Save both
        localStorage.setItem('archivedProjects', JSON.stringify(archivedProjects));
        this.saveToStorage();
        this.renderProjects();
        this.closeModal();
        this.updateTickerStats();
        
        // Show notification
        this.showNotification(`Project "${project.title}" has been archived! 📦`, 'success');
    }
    
    updateTickerStats() {
        // This method can be used to force update ticker stats when projects change
        // The ticker will automatically pick up changes on its next interval
    }

    calculateProgress(steps) {
        if (!steps || steps.length === 0) return 0;
        const completedSteps = steps.filter(step => step.completed).length;
        return Math.round((completedSteps / steps.length) * 100);
    }
    
    toggleStep(projectId, stepId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project || !project.steps) return;
        
        const step = project.steps.find(s => s.id === stepId);
        if (step) {
            step.completed = !step.completed;
            project.progress = this.calculateProgress(project.steps);
            this.saveToStorage();
            this.renderProjects();
        }
    }

    saveToStorage() {
        try {
            // Save to localStorage (primary storage)
            localStorage.setItem('projects', JSON.stringify(this.projects));
            
            // Create a backup with timestamp
            const backup = {
                projects: this.projects,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem('projects_backup', JSON.stringify(backup));
            
            // Keep last 5 backups in a rotation
            this.rotateBackups();
            
            console.log('Data saved successfully to localStorage');
        } catch (error) {
            console.error('Failed to save data:', error);
            alert('Warning: Failed to save data. Your changes may be lost if you close the browser.');
        }
    }
    
    rotateBackups() {
        try {
            const maxBackups = 5;
            let backups = JSON.parse(localStorage.getItem('projects_backups') || '[]');
            
            // Add current backup
            const currentBackup = {
                projects: this.projects,
                timestamp: new Date().toISOString()
            };
            
            backups.unshift(currentBackup);
            
            // Keep only the most recent backups
            if (backups.length > maxBackups) {
                backups = backups.slice(0, maxBackups);
            }
            
            localStorage.setItem('projects_backups', JSON.stringify(backups));
        } catch (error) {
            console.error('Failed to create backup:', error);
        }
    }

    renderStatusSummary() {
        const statusStatsContainer = document.getElementById('status-stats');
        const stats = this.getProjectStats();
        const archivedCount = this.getArchivedCount();
        
        if (stats.total === 0 && archivedCount === 0) {
            statusStatsContainer.innerHTML = `
                <div class="stat-card total">
                    <span class="stat-icon">📊</span>
                    <div class="stat-number">0</div>
                    <div class="stat-label">Total Projects</div>
                </div>
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #636e72;">
                    <p>Add your first project to see status overview</p>
                </div>
            `;
            return;
        }
        
        const statusConfig = {
            'total': { icon: '📊', label: 'Active Projects', class: 'total' },
            'not-started': { icon: '⛔️', label: 'Not Started', class: 'not-started' },
            'in-progress': { icon: '🔄', label: 'In Progress', class: 'in-progress' },
            'completed': { icon: '✅', label: 'Completed', class: 'completed' },
            'on-hold': { icon: '⏸️', label: 'On Hold', class: 'on-hold' },
            'archived': { icon: '🔒', label: 'Archived', class: 'archived' }
        };
        
        // Create stats array including archived count
        const statsWithArchived = { ...stats, archived: archivedCount };
        
        statusStatsContainer.innerHTML = Object.entries(statusConfig)
            .filter(([key]) => {
                if (key === 'total') return true;
                if (key === 'archived') return archivedCount > 0;
                return stats[key] > 0;
            })
            .map(([key, config]) => `
                <div class="stat-card ${config.class}" ${key === 'archived' ? 'onclick="window.location.href=\'archived.html\'" style="cursor: pointer;"' : ''}>
                    <span class="stat-icon">${config.icon}</span>
                    <div class="stat-number">${statsWithArchived[key]}</div>
                    <div class="stat-label">${config.label}</div>
                </div>
            `).join('');
    }
    
    renderProjects() {
        this.renderStatusSummary();
        
        const container = document.getElementById('projects-container');
        
        if (this.projects.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: rgba(255,255,255,0.8);">
                    <h2>No projects yet</h2>
                    <p>Click "Add New Project" to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.projects.map(project => this.createProjectCard(project)).join('');
        
        // Update ticker with new project stats when projects are rendered
        this.updateTickerStats();
    }

    createProjectCard(project) {
        const daysUntilDue = this.getDaysUntilDue(project.dueDate);
        const statusClass = `status-${project.status.replace(' ', '-')}`;
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${project.title}</h3>
                        <span class="project-status ${statusClass}">${project.status.replace('-', ' ')}</span>
                    </div>
                </div>
                
                <div class="project-details">${project.details}</div>
                
                <div class="project-dates">
                    <span><strong>Start:</strong> ${this.formatDate(project.startDate)}</span>
                    <span><strong>Due:</strong> ${this.formatDate(project.dueDate)} (${daysUntilDue})</span>
                </div>
                
                ${this.renderProjectDependencies(project)}
                
                <div class="progress-section">
                    <div class="progress-label">
                        <span>Progress</span>
                        <span>${project.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress}%"></div>
                    </div>
                </div>
                
                <div class="steps-container">
                    ${this.renderProjectSteps(project)}
                </div>
                
                <div class="project-actions">
                    <button class="btn-small btn-edit" onclick="dashboard.openModal('${project.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn-small btn-delete" onclick="dashboard.deleteProject('${project.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    renderProjectDependencies(project) {
        if (!project.dependencies || project.dependencies.length === 0) {
            return '';
        }
        
        const dependencyProjects = project.dependencies.map(depId => {
            const depProject = this.projects.find(p => p.id === depId);
            if (!depProject) {
                // Check archived projects too
                const archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
                const archivedProject = archivedProjects.find(p => p.id === depId);
                return archivedProject ? { ...archivedProject, isArchived: true } : null;
            }
            return depProject;
        }).filter(Boolean);
        
        if (dependencyProjects.length === 0) {
            return '';
        }
        
        const hasUncompletedDeps = dependencyProjects.some(dep => 
            !dep.isArchived && dep.status !== 'completed'
        );
        
        return `
            <div class="dependencies-container">
                <div class="dependencies-header">
                    <h4>📋 Dependencies</h4>
                    <span class="dependencies-status ${hasUncompletedDeps ? 'blocked' : 'ready'}">
                        ${hasUncompletedDeps ? '⚠️ Blocked' : '✅ Ready'}
                    </span>
                </div>
                <div class="dependencies-list">
                    ${dependencyProjects.map(dep => `
                        <div class="dependency-item ${dep.isArchived ? 'archived' : dep.status}">
                            <span class="dependency-status-icon">
                                ${dep.isArchived ? '📦' : dep.status === 'completed' ? '✅' : 
                                  dep.status === 'in-progress' ? '🔄' : 
                                  dep.status === 'on-hold' ? '⏸️' : '⛔'}
                            </span>
                            <span class="dependency-title">${dep.title}</span>
                            <span class="dependency-status-text">
                                ${dep.isArchived ? 'Archived' : dep.status.replace('-', ' ')}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderProjectSteps(project) {
        if (!project.steps || project.steps.length === 0) {
            return `
                <div class="steps-header">
                    <h4>Project Steps</h4>
                    <span class="steps-count">No steps defined</span>
                </div>
                <p style="color: #666; font-style: italic; margin: 1rem 0;">Edit this project to add steps</p>
            `;
        }
        
        const completedSteps = project.steps.filter(step => step.completed).length;
        const totalSteps = project.steps.length;
        
        return `
            <div class="steps-header">
                <h4>Project Steps</h4>
                <span class="steps-count">${completedSteps}/${totalSteps} completed</span>
            </div>
            <div class="steps-list">
                ${project.steps.map(step => `
                    <div class="step-item ${step.completed ? 'completed' : ''}">
                        <label class="step-checkbox">
                            <input type="checkbox" 
                                   ${step.completed ? 'checked' : ''} 
                                   onchange="dashboard.toggleStep('${project.id}', '${step.id}')">
                            <span class="checkmark"></span>
                            <span class="step-text">${step.text}</span>
                        </label>
                    </div>
                `).join('')}
            </div>
        `;
    }


    getDaysUntilDue(dueDate) {
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return `${Math.abs(diffDays)} days overdue`;
        } else if (diffDays === 0) {
            return 'Due today';
        } else {
            return `${diffDays} days left`;
        }
    }

    getDaysBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    updateDateTime() {
        const now = new Date();
        const dateElement = document.getElementById('current-date');
        
        const dateString = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        dateElement.textContent = `📅 ${dateString} - ${timeString}`;
    }

    checkNetworkStatus() {
        const statusElement = document.getElementById('network-status');
        
        if (navigator.onLine) {
            statusElement.innerHTML = '🟢 Online';
            statusElement.style.color = '#00b894';
        } else {
            statusElement.innerHTML = '🔴 Offline';
            statusElement.style.color = '#d63031';
        }
    }

    async fetchLocalNews() {
        try {
            // Free news API - NewsAPI.org (you can sign up for a free API key)
            // For demo purposes, we'll use mock local news data
            // In production, replace with: `https://newsapi.org/v2/top-headlines?country=us&category=general&apiKey=YOUR_API_KEY`
            
            // Mock local news data (replace with real API call)
            const mockNews = [
                '🏢 Local tech company announces 100 new jobs in downtown area',
                '🚧 Main Street construction project to begin Monday, expect delays',
                '🌡️ Weather: Sunny skies expected through the weekend, high of 75°F',
                '🎭 Annual arts festival kicks off this Saturday at City Park',
                '🚌 Public transit adds new express route to business district',
                '📚 City library extends hours, now open until 9 PM weekdays',
                '🏥 New urgent care facility opens on Oak Street',
                '⚽ Local high school soccer team wins regional championship',
                '🎵 Summer concert series begins next Friday at Riverside Amphitheater',
                '🛒 Farmer\'s market returns to downtown square every Saturday'
            ];
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Return 3-5 random news items
            const shuffled = mockNews.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, Math.floor(Math.random() * 3) + 3);
            
        } catch (error) {
            console.log('Failed to fetch local news:', error);
            return ['📰 Unable to load local news at this time'];
        }
    }

    getProjectStats() {
        const totalProjects = this.projects.length;
        const stats = {
            total: totalProjects,
            'not-started': 0,
            'in-progress': 0,
            'completed': 0,
            'on-hold': 0
        };
        
        this.projects.forEach(project => {
            stats[project.status]++;
        });
        
        return stats;
    }
    
    getArchivedCount() {
        try {
            const archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
            return archivedProjects.length;
        } catch (error) {
            console.error('Failed to get archived count:', error);
            return 0;
        }
    }
    
    getProjectStatsMessages() {
        const stats = this.getProjectStats();
        const messages = [];
        
        console.log('Project Stats:', stats); // Debug log
        
        if (stats.total === 0) {
            messages.push('📊 No projects yet - Add your first project to get started!');
        } else {
            messages.push(`📊 Total Projects: ${stats.total}`);
            
            if (stats['not-started'] > 0) {
                messages.push(`🔵 Not Started: ${stats['not-started']} project${stats['not-started'] > 1 ? 's' : ''}`);
            }
            
            if (stats['in-progress'] > 0) {
                messages.push(`🟡 In Progress: ${stats['in-progress']} project${stats['in-progress'] > 1 ? 's' : ''}`);
            }
            
            if (stats['completed'] > 0) {
                messages.push(`🟢 Completed: ${stats['completed']} project${stats['completed'] > 1 ? 's' : ''}`);
            }
            
            if (stats['on-hold'] > 0) {
                messages.push(`🟠 On Hold: ${stats['on-hold']} project${stats['on-hold'] > 1 ? 's' : ''}`);
            }
            
            // Add completion percentage if there are projects
            const completionRate = Math.round((stats.completed / stats.total) * 100);
            messages.push(`📈 Project Completion Rate: ${completionRate}%`);
        }
        
        console.log('Project Stats Messages:', messages); // Debug log
        return messages;
    }

    async startTicker() {
        const tickerContent = document.querySelector('.ticker-content span');
        
        const dashboardMessages = [
            '📰 Welcome to Joe\'s Status Dashboard',
            '📊 Track your project progress with interactive charts',
            '⏰ Stay on top of deadlines and milestones',
            '✅ Organize tasks efficiently',
            '📈 Monitor completion rates in real-time',
            '🎯 Achieve your project goals',
            '💾 All data saved locally in your browser',
            '🌟 Click Help for detailed documentation'
        ];
        
        // Get project statistics messages
        const projectStatsMessages = this.getProjectStatsMessages();
        console.log('Initial project stats messages:', projectStatsMessages); // Debug log
        
        // Fetch initial local news
        let localNews = await this.fetchLocalNews();
        
        // Combine all messages: dashboard messages, project stats, and local news
        let allMessages = [...dashboardMessages, ...projectStatsMessages, ...localNews];
        let currentIndex = 0;
        
        console.log('All ticker messages:', allMessages); // Debug log
        
        // Update ticker content immediately
        if (allMessages.length > 1) {
            tickerContent.textContent = allMessages[0] + ' • ' + allMessages[1];
        } else {
            tickerContent.textContent = allMessages[0] || 'Loading dashboard...';
        }
        
        // Update ticker every 15 seconds (slower than before)
        const tickerInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % allMessages.length;
            const nextIndex = (currentIndex + 1) % allMessages.length;
            tickerContent.textContent = allMessages[currentIndex] + ' • ' + allMessages[nextIndex];
        }, 15000);
        
        // Update project stats every 30 seconds
        setInterval(() => {
            const newProjectStatsMessages = this.getProjectStatsMessages();
            allMessages = [...dashboardMessages, ...newProjectStatsMessages, ...localNews];
            console.log('Updated ticker messages:', allMessages); // Debug log
        }, 30000);
        
        // Refresh local news every 30 minutes
        setInterval(async () => {
            console.log('Refreshing local news...');
            const newLocalNews = await this.fetchLocalNews();
            const currentProjectStatsMessages = this.getProjectStatsMessages();
            allMessages = [...dashboardMessages, ...currentProjectStatsMessages, ...newLocalNews];
        }, 30 * 60 * 1000);
    }
    
    exportData() {
        try {
            const exportData = {
                projects: this.projects,
                exportDate: new Date().toISOString(),
                version: '1.0',
                source: 'Joe\'s Status Dashboard'
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `dashboard-backup-${dateStr}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success message
            this.showNotification('Data exported successfully! 📤', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Failed to export data. ❌', 'error');
        }
    }
    
    importData() {
        const fileInput = document.getElementById('import-file');
        fileInput.click();
    }
    
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Validate the imported data
                if (!importedData.projects || !Array.isArray(importedData.projects)) {
                    throw new Error('Invalid file format');
                }
                
                // Ask user for confirmation
                const confirmMessage = `Import ${importedData.projects.length} project(s)? This will replace your current data.`;
                if (confirm(confirmMessage)) {
                    this.projects = importedData.projects;
                    this.saveToStorage();
                    this.renderProjects();
                    this.showNotification('Data imported successfully! 📥', 'success');
                }
                
            } catch (error) {
                console.error('Import failed:', error);
                this.showNotification('Failed to import data. Invalid file format. ❌', 'error');
            }
        };
        
        reader.readAsText(file);
        
        // Clear the file input
        event.target.value = '';
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#55efc4' : type === 'error' ? '#fd79a8' : '#74b9ff'};
            color: ${type === 'success' ? '#00b894' : type === 'error' ? '#e84393' : '#0984e3'};
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the dashboard when the page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new StatusDashboard();
});

// Handle online/offline events
window.addEventListener('online', () => dashboard.checkNetworkStatus());
window.addEventListener('offline', () => dashboard.checkNetworkStatus());

