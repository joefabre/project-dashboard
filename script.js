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
        const printBtn = document.getElementById('print-btn');

        addBtn.addEventListener('click', () => this.openModal());
        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        helpBtn.addEventListener('click', () => this.openHelp());
        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => this.importData());
        printBtn.addEventListener('click', () => this.printProjects());
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
            dependenciesSelect.innerHTML = '<option disabled>No other projects or tasks available</option>';
            return;
        }
        
        availableProjects.forEach(project => {
            // Add project as dependency option
            const projectOption = document.createElement('option');
            projectOption.value = `project:${project.id}`;
            projectOption.textContent = `${project.title} (Project - ${project.status.replace('-', ' ')})`;
            dependenciesSelect.appendChild(projectOption);
            
            // Add project tasks as dependency options
            if (project.steps && project.steps.length > 0) {
                project.steps.forEach(step => {
                    const taskOption = document.createElement('option');
                    taskOption.value = `task:${project.id}:${step.id}`;
                    taskOption.textContent = `  Task: ${step.text} (${step.completed ? 'Completed' : 'Pending'})`;
                    dependenciesSelect.appendChild(taskOption);
                });
            }
        });
    }
    
    populateForm(project) {
        document.getElementById('project-title').value = project.title;
        document.getElementById('project-details').value = project.details;
        document.getElementById('start-date').value = project.startDate;
        document.getElementById('due-date').value = project.dueDate;
        document.getElementById('project-status').value = project.status;
        
        // Handle recurring project checkbox
        document.getElementById('project-recurring').checked = project.isRecurring || false;
        
        // Handle project dependencies
        const dependenciesSelect = document.getElementById('project-dependencies');
        const dependencies = project.dependencies || [];
        Array.from(dependenciesSelect.options).forEach(option => {
            option.selected = dependencies.includes(option.value);
        });
        
        // Handle project steps - preserve subtask formatting
        const steps = project.steps || [];
        const stepsText = steps.map(step => {
            // If it's a sub-subtask, add the ++ prefix back
            if (step.isSubSubtask) {
                return '++ ' + step.text;
            }
            // If it's a subtask, add the + prefix back
            else if (step.isSubtask) {
                return '+ ' + step.text;
            }
            return step.text;
        }).join('\n');
        document.getElementById('project-steps').value = stepsText;
    }

    saveProject() {
        const stepsText = document.getElementById('project-steps').value.trim();
        const steps = this.parseStepsWithSubtasks(stepsText);
        
        // Get selected dependencies
        const dependenciesSelect = document.getElementById('project-dependencies');
        const dependencies = Array.from(dependenciesSelect.selectedOptions).map(option => option.value);
        
        const formData = {
            title: document.getElementById('project-title').value.trim(),
            details: document.getElementById('project-details').value.trim(),
            startDate: document.getElementById('start-date').value,
            dueDate: document.getElementById('due-date').value,
            status: document.getElementById('project-status').value,
            isRecurring: document.getElementById('project-recurring').checked,
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
    
    hasUnmetDependencies(project) {
        if (!project.dependencies || project.dependencies.length === 0) {
            return false;
        }
        
        return project.dependencies.some(depId => {
            if (depId.startsWith('project:')) {
                // Project dependency
                const projectId = depId.replace('project:', '');
                const depProject = this.projects.find(p => p.id === projectId);
                if (!depProject) {
                    // Check archived projects
                    const archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
                    const archivedProject = archivedProjects.find(p => p.id === projectId);
                    return !archivedProject; // If not found in archived, it's unmet
                }
                return depProject.status !== 'completed';
            } else if (depId.startsWith('task:')) {
                // Task dependency
                const [, projectId, taskId] = depId.split(':');
                const depProject = this.projects.find(p => p.id === projectId) || 
                    (JSON.parse(localStorage.getItem('archivedProjects')) || []).find(p => p.id === projectId);
                if (depProject && depProject.steps) {
                    const task = depProject.steps.find(s => s.id === taskId);
                    return !task || !task.completed;
                }
                return true; // If task not found, consider it unmet
            } else {
                // Legacy project dependency
                const depProject = this.projects.find(p => p.id === depId);
                if (!depProject) {
                    const archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
                    const archivedProject = archivedProjects.find(p => p.id === depId);
                    return !archivedProject;
                }
                return depProject.status !== 'completed';
            }
        });
    }
    
    toggleStep(projectId, stepId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project || !project.steps) return;
        
        // Check if project has unmet dependencies before allowing task completion
        const hasUnmetDependencies = this.hasUnmetDependencies(project);
        
        const step = project.steps.find(s => s.id === stepId);
        if (step) {
            // If trying to complete a task but dependencies are not met, block it
            if (!step.completed && hasUnmetDependencies) {
                this.showNotification('Cannot complete tasks while project dependencies are not met. Complete dependencies first.', 'error');
                return;
            }
            
            // Check completion logic based on task hierarchy
            if (!step.completed) {
                // For parent tasks (level 0), check all subtasks and sub-subtasks
                if (!step.isSubtask && step.subtasks && step.subtasks.length > 0) {
                    const allChildrenCompleted = step.subtasks.every(subtaskId => {
                        const subtask = project.steps.find(s => s.id === subtaskId);
                        if (!subtask || !subtask.completed) {
                            return false;
                        }
                        
                        // If this subtask has sub-subtasks, check them too
                        if (subtask.subtasks && subtask.subtasks.length > 0) {
                            return subtask.subtasks.every(subSubtaskId => {
                                const subSubtask = project.steps.find(s => s.id === subSubtaskId);
                                return subSubtask && subSubtask.completed;
                            });
                        }
                        
                        return true;
                    });
                    
                    if (!allChildrenCompleted) {
                        this.showNotification('Cannot complete parent task until all subtasks and sub-subtasks are completed.', 'error');
                        return;
                    }
                }
                // For subtasks (level 1), check all sub-subtasks
                else if (step.isSubtask && !step.isSubSubtask && step.subtasks && step.subtasks.length > 0) {
                    const allSubSubtasksCompleted = step.subtasks.every(subSubtaskId => {
                        const subSubtask = project.steps.find(s => s.id === subSubtaskId);
                        return subSubtask && subSubtask.completed;
                    });
                    
                    if (!allSubSubtasksCompleted) {
                        this.showNotification('Cannot complete subtask until all sub-subtasks are completed.', 'error');
                        return;
                    }
                }
            }
            
            step.completed = !step.completed;
            project.progress = this.calculateProgress(project.steps);
            
            // Check if all steps are completed
            const allStepsCompleted = project.steps.every(s => s.completed);
            
            if (allStepsCompleted && project.isRecurring) {
                // For recurring projects, reset all steps and show notification
                setTimeout(() => {
                    project.steps.forEach(s => s.completed = false);
                    project.progress = 0;
                    project.status = 'in-progress'; // Reset status to in-progress
                    this.saveToStorage();
                    this.renderProjects();
                    this.showNotification(`🔄 Recurring project "${project.title}" has been reset and is ready for the next cycle!`, 'success');
                }, 1500); // 1.5 second delay like archiving
                
                // Show initial completion message
                this.showNotification(`🎉 Great job! "${project.title}" completed successfully!`, 'success');
            } else if (allStepsCompleted && !project.isRecurring) {
                // For non-recurring projects, handle normal completion/archiving
                project.status = 'completed';
                setTimeout(() => {
                    this.archiveProject(projectId);
                }, 1500);
                
                this.showNotification(`🎉 Project "${project.title}" completed! Moving to archive...`, 'success');
            }
            
            this.saveToStorage();
            this.renderProjects();
        }
    }

    canCompleteParentTask(project, parentTask) {
        // If it's not a parent task, it can always be completed
        if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
            return true;
        }
        
        // For parent tasks, all subtasks (and their sub-subtasks) must be completed
        return parentTask.subtasks.every(subtaskId => {
            const subtask = project.steps.find(step => step.id === subtaskId);
            if (!subtask || !subtask.completed) {
                return false;
            }
            
            // If this subtask has sub-subtasks, check them too
            if (subtask.subtasks && subtask.subtasks.length > 0) {
                return subtask.subtasks.every(subSubtaskId => {
                    const subSubtask = project.steps.find(step => step.id === subSubtaskId);
                    return subSubtask && subSubtask.completed;
                });
            }
            
            return true;
        });
    }

    parseStepsWithSubtasks(stepsText) {
        if (!stepsText) return [];
        
        const lines = stepsText.split('\n').filter(line => line.trim());
        const steps = [];
        let currentParentIndex = -1;
        let currentSubtaskIndex = -1;
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            const isSubSubtask = trimmedLine.startsWith('++');
            const isSubtask = !isSubSubtask && trimmedLine.startsWith('+');
            
            if (isSubSubtask) {
                // This is a sub-subtask (++)
                const subSubtaskText = trimmedLine.substring(2).trim(); // Remove '++' and trim
                if (subSubtaskText && currentSubtaskIndex >= 0) {
                    const subSubtaskId = `step-${Date.now()}-${index}`;
                    const subSubtask = {
                        id: subSubtaskId,
                        text: subSubtaskText,
                        completed: false,
                        isSubtask: true,
                        isSubSubtask: true,
                        level: 2,
                        parentId: steps[currentSubtaskIndex].id,
                        rootParentId: steps[currentParentIndex].id
                    };
                    
                    // Add sub-subtask to steps array
                    steps.push(subSubtask);
                    
                    // Add sub-subtask reference to immediate parent (subtask)
                    if (!steps[currentSubtaskIndex].subtasks) {
                        steps[currentSubtaskIndex].subtasks = [];
                    }
                    steps[currentSubtaskIndex].subtasks.push(subSubtaskId);
                }
            } else if (isSubtask) {
                // This is a subtask (+)
                const subtaskText = trimmedLine.substring(1).trim(); // Remove '+' and trim
                if (subtaskText && currentParentIndex >= 0) {
                    const subtaskId = `step-${Date.now()}-${index}`;
                    const subtask = {
                        id: subtaskId,
                        text: subtaskText,
                        completed: false,
                        isSubtask: true,
                        isSubSubtask: false,
                        level: 1,
                        parentId: steps[currentParentIndex].id,
                        subtasks: []
                    };
                    
                    // Add subtask to steps array
                    steps.push(subtask);
                    currentSubtaskIndex = steps.length - 1;
                    
                    // Add subtask reference to parent
                    if (!steps[currentParentIndex].subtasks) {
                        steps[currentParentIndex].subtasks = [];
                    }
                    steps[currentParentIndex].subtasks.push(subtaskId);
                }
            } else {
                // This is a parent task
                const parentId = `step-${Date.now()}-${index}`;
                const parentTask = {
                    id: parentId,
                    text: trimmedLine,
                    completed: false,
                    isSubtask: false,
                    isSubSubtask: false,
                    level: 0,
                    subtasks: []
                };
                
                steps.push(parentTask);
                currentParentIndex = steps.length - 1;
                currentSubtaskIndex = -1; // Reset subtask index when we hit a new parent
            }
        });
        
        return steps;
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

        // Sort projects: "in-progress" first, then "not-started", then by due date within each group
        const sortedProjects = this.sortProjectsByStatusAndDueDate(this.projects);
        
        container.innerHTML = sortedProjects.map(project => this.createProjectCard(project)).join('');
        
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
                        <h3 class="project-title">${project.title}${project.isRecurring ? ' 🔄' : ''}</h3>
                        <span class="project-status ${statusClass}">${project.status.replace('-', ' ')}</span>
                        ${project.isRecurring ? '<span class="recurring-badge">🔄 Recurring</span>' : ''}
                    </div>
                </div>
                
                <div class="project-content">
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
                
            </div>
            </div>
        `;
    }

    renderProjectDependencies(project) {
        if (!project.dependencies || project.dependencies.length === 0) {
            return '';
        }
        
        const dependencyItems = project.dependencies.map(depId => {
            if (depId.startsWith('project:')) {
                // Project dependency
                const projectId = depId.replace('project:', '');
                const depProject = this.projects.find(p => p.id === projectId);
                if (!depProject) {
                    // Check archived projects too
                    const archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
                    const archivedProject = archivedProjects.find(p => p.id === projectId);
                    return archivedProject ? { ...archivedProject, isArchived: true, type: 'project' } : null;
                }
                return { ...depProject, type: 'project' };
            } else if (depId.startsWith('task:')) {
                // Task dependency
                const [, projectId, taskId] = depId.split(':');
                const depProject = this.projects.find(p => p.id === projectId) || 
                    (JSON.parse(localStorage.getItem('archivedProjects')) || []).find(p => p.id === projectId);
                if (depProject && depProject.steps) {
                    const task = depProject.steps.find(s => s.id === taskId);
                    if (task) {
                        return {
                            id: taskId,
                            title: task.text,
                            status: task.completed ? 'completed' : 'pending',
                            type: 'task',
                            projectTitle: depProject.title,
                            isArchived: depProject.archivedAt ? true : false
                        };
                    }
                }
                return null;
            } else {
                // Legacy project dependency (backward compatibility)
                const depProject = this.projects.find(p => p.id === depId);
                if (!depProject) {
                    const archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
                    const archivedProject = archivedProjects.find(p => p.id === depId);
                    return archivedProject ? { ...archivedProject, isArchived: true, type: 'project' } : null;
                }
                return { ...depProject, type: 'project' };
            }
        }).filter(Boolean);
        
        if (dependencyItems.length === 0) {
            return '';
        }
        
        const hasUncompletedDeps = dependencyItems.some(dep => {
            if (dep.type === 'project') {
                return !dep.isArchived && dep.status !== 'completed';
            } else if (dep.type === 'task') {
                return dep.status !== 'completed' && !dep.isArchived;
            }
            return false;
        });
        
        return `
            <div class="dependencies-container">
                <div class="dependencies-header">
                    <h4>Dependencies</h4>
                    <span class="dependencies-status ${hasUncompletedDeps ? 'blocked' : 'ready'}">
                        ${hasUncompletedDeps ? 'Blocked' : 'Ready'}
                    </span>
                </div>
                <div class="dependencies-list">
                    ${dependencyItems.map(dep => {
                        if (dep.type === 'project') {
                            const statusText = dep.isArchived ? 'Archived' : dep.status.replace('-', ' ');
                            const capitalizedStatusText = statusText.charAt(0).toUpperCase() + statusText.slice(1);
                            return `
                                <div class="dependency-item ${dep.isArchived ? 'archived' : dep.status}">
                                    <span class="dependency-title">${dep.title} (Project)</span>
                                    <span class="dependency-status-text">
                                        ${capitalizedStatusText}
                                    </span>
                                </div>
                            `;
                        } else if (dep.type === 'task') {
                            const capitalizedTaskTitle = dep.title.charAt(0).toUpperCase() + dep.title.slice(1);
                            return `
                                <div class="dependency-item ${dep.status} task-dependency">
                                    <span class="dependency-title">${capitalizedTaskTitle} (Task from ${dep.projectTitle})</span>
                                    <span class="dependency-status-text">
                                        ${dep.status === 'completed' ? 'Completed' : 'Pending'}
                                    </span>
                                </div>
                            `;
                        }
                        return '';
                    }).join('')}
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
        const hasUnmetDependencies = this.hasUnmetDependencies(project);
        
        return `
            <div class="steps-header">
                <h4>Project Steps</h4>
                <span class="steps-count">${completedSteps}/${totalSteps} completed</span>
                ${hasUnmetDependencies ? '<span class="blocked-indicator">🔒 Blocked</span>' : ''}
            </div>
            <div class="steps-list">
                ${project.steps.map(step => {
                    const isSubtask = step.isSubtask && !step.isSubSubtask;
                    const isSubSubtask = step.isSubSubtask;
                    const isParentTask = !step.isSubtask && step.subtasks && step.subtasks.length > 0;
                    const isSubtaskWithChildren = isSubtask && step.subtasks && step.subtasks.length > 0;
                    
                    // Check if this task can be completed based on its children
                    let canComplete = true;
                    let blockReason = '';
                    
                    // For parent tasks, check all subtasks and sub-subtasks
                    if (isParentTask && !step.completed) {
                        canComplete = this.canCompleteParentTask(project, step);
                        if (!canComplete) {
                            blockReason = 'Complete all subtasks first';
                        }
                    }
                    // For subtasks with sub-subtasks, check all sub-subtasks
                    else if (isSubtaskWithChildren && !step.completed) {
                        canComplete = step.subtasks.every(subSubtaskId => {
                            const subSubtask = project.steps.find(s => s.id === subSubtaskId);
                            return subSubtask && subSubtask.completed;
                        });
                        if (!canComplete) {
                            blockReason = 'Complete all sub-subtasks first';
                        }
                    }
                    
                    // Final disability check includes dependencies and child completion
                    const isDisabled = (hasUnmetDependencies && !step.completed) || (!canComplete && !step.completed);
                    
                    // Add additional classes for sub-sub tasks
                    let stepClasses = `step-item ${step.completed ? 'completed' : ''}`;
                    if (isSubSubtask) {
                        stepClasses += ' subtask sub-subtask';
                    } else if (isSubtask) {
                        stepClasses += ' subtask';
                        if (isSubtaskWithChildren) {
                            stepClasses += ' parent-subtask';
                        }
                    }
                    if (isParentTask) {
                        stepClasses += ' parent-task';
                    }
                    if (isDisabled) {
                        stepClasses += ' blocked';
                    }
                    
                    return `
                        <div class="${stepClasses}" ${blockReason ? `title="${blockReason}"` : ''}>
                            <label class="step-checkbox">
                                <input type="checkbox" 
                                       ${step.completed ? 'checked' : ''} 
                                       ${isDisabled ? 'disabled' : ''}
                                       onchange="dashboard.toggleStep('${project.id}', '${step.id}')">
                                <span class="checkmark"></span>
                                <span class="step-text">${step.text}</span>
                            </label>
                        </div>
                    `;
                }).join('')}
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

    async checkNetworkStatus() {
        const statusElement = document.getElementById('network-status');
        
        if (!statusElement) {
            console.error('Network status element not found');
            return;
        }
        
        try {
            if (navigator.onLine) {
                // Get connection information
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                let networkInfo = '🟢 Online';
                
                if (connection) {
                    const type = connection.effectiveType || connection.type || 'unknown';
                    const downlink = connection.downlink ? `${Math.round(connection.downlink * 10) / 10} Mbps` : '';
                    
                    // Map connection types to readable names
                    const typeMap = {
                        'slow-2g': '📶 2G (Slow)',
                        '2g': '📶 2G',
                        '3g': '📶 3G',
                        '4g': '📶 4G/LTE',
                        'wifi': '📶 WiFi',
                        'ethernet': '🔌 Ethernet',
                        'cellular': '📱 Cellular',
                        'bluetooth': '🔵 Bluetooth',
                        'wimax': '📡 WiMAX',
                        'other': '🌐 Other',
                        'unknown': '❓ Unknown'
                    };
                    
                    const connectionType = typeMap[type] || `📶 ${type.toUpperCase()}`;
                    networkInfo = `🟢 ${connectionType}`;
                    
                    if (downlink && downlink !== '0 Mbps') {
                        networkInfo += ` (${downlink})`;
                    }
                    
                    // Add data saver indicator
                    if (connection.saveData) {
                        networkInfo += ' 💾';
                    }
                } else {
                    // Fallback for browsers without connection API
                    // Try to determine if we're on WiFi vs cellular (very basic heuristic)
                    networkInfo = '🟢 🌐 Connected';
                }
                
                statusElement.innerHTML = networkInfo;
                statusElement.style.color = '#00b894';
                
            } else {
                statusElement.innerHTML = '🔴 Offline';
                statusElement.style.color = '#d63031';
            }
        } catch (error) {
            console.error('Error checking network status:', error);
            statusElement.innerHTML = navigator.onLine ? '🟢 Online' : '🔴 Offline';
            statusElement.style.color = navigator.onLine ? '#00b894' : '#d63031';
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
    
    printProjects() {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Get current date for header
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Get archived projects for complete overview
        const archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
        
        // Generate print content
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Project Status Report - ${currentDate}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                        line-height: 1.4;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 20px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        color: #2c3e50;
                    }
                    .header p {
                        margin: 5px 0 0 0;
                        color: #666;
                        font-size: 14px;
                    }
                    .summary {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin-bottom: 30px;
                        text-align: center;
                    }
                    .stat-box {
                        border: 1px solid #ddd;
                        padding: 15px;
                        border-radius: 8px;
                    }
                    .stat-number {
                        font-size: 24px;
                        font-weight: bold;
                        color: #2c3e50;
                    }
                    .stat-label {
                        font-size: 12px;
                        color: #666;
                        text-transform: uppercase;
                        margin-top: 5px;
                    }
                    .section {
                        margin-bottom: 40px;
                        page-break-inside: avoid;
                    }
                    .section h2 {
                        color: #2c3e50;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .project {
                        border: 1px solid #ddd;
                        margin-bottom: 20px;
                        padding: 15px;
                        border-radius: 8px;
                        page-break-inside: avoid;
                    }
                    .project-title {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 8px;
                        color: #2c3e50;
                    }
                    .project-status {
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: bold;
                        text-transform: uppercase;
                        margin-bottom: 10px;
                    }
                    .status-not-started { background: #ffeaa7; color: #d63031; }
                    .status-in-progress { background: #74b9ff; color: #0984e3; }
                    .status-completed { background: #55efc4; color: #00b894; }
                    .status-on-hold { background: #fd79a8; color: #e84393; }
                    .project-details {
                        margin-bottom: 10px;
                        color: #666;
                    }
                    .project-dates {
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 15px;
                    }
                    .dependencies {
                        margin-bottom: 15px;
                    }
                    .dependencies h4 {
                        margin: 0 0 8px 0;
                        font-size: 14px;
                        color: #2c3e50;
                    }
                    .dependency-item {
                        font-size: 12px;
                        padding: 4px 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        margin-bottom: 4px;
                        border-left: 3px solid #667eea;
                    }
                    .steps {
                        margin-bottom: 15px;
                    }
                    .steps h4 {
                        margin: 0 0 8px 0;
                        font-size: 14px;
                        color: #2c3e50;
                    }
                    .step {
                        font-size: 12px;
                        padding: 4px 0;
                        display: flex;
                        align-items: center;
                    }
                    .step-checkbox {
                        width: 12px;
                        height: 12px;
                        border: 1px solid #333;
                        margin-right: 8px;
                        display: inline-block;
                        text-align: center;
                        line-height: 10px;
                        font-size: 8px;
                    }
                    .step-completed {
                        text-decoration: line-through;
                        color: #666;
                    }
                    .progress-bar {
                        width: 100%;
                        height: 8px;
                        background: #e9ecef;
                        border-radius: 4px;
                        overflow: hidden;
                        margin-bottom: 5px;
                    }
                    .progress-fill {
                        height: 100%;
                        background: #667eea;
                    }
                    .progress-text {
                        font-size: 12px;
                        color: #666;
                        text-align: right;
                    }
                    @media print {
                        body { margin: 0; }
                        .section { page-break-before: auto; }
                        .project { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Project Status Dashboard Report</h1>
                    <p>Generated on ${currentDate}</p>
                </div>
                
                ${this.generatePrintSummary()}
                
                ${this.projects.length > 0 ? `
                <div class="section">
                    <h2>📋 Active Projects (${this.projects.length})</h2>
                    ${this.projects.map(project => this.generatePrintProject(project)).join('')}
                </div>
                ` : '<div class="section"><h2>📋 Active Projects</h2><p>No active projects</p></div>'}
                
                ${archivedProjects.length > 0 ? `
                <div class="section">
                    <h2>📦 Archived Projects (${archivedProjects.length})</h2>
                    ${archivedProjects.map(project => this.generatePrintProject(project, true)).join('')}
                </div>
                ` : ''}
            </body>
            </html>
        `;
        
        // Write content and print
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
        
        // Show notification
        this.showNotification('Print dialog opened! 🖨️', 'success');
    }
    
    generatePrintSummary() {
        const stats = this.getProjectStats();
        const archivedCount = this.getArchivedCount();
        
        return `
            <div class="summary">
                <div class="stat-box">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">Active Projects</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats['not-started'] || 0}</div>
                    <div class="stat-label">Not Started</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats['in-progress'] || 0}</div>
                    <div class="stat-label">In Progress</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats['on-hold'] || 0}</div>
                    <div class="stat-label">On Hold</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${archivedCount}</div>
                    <div class="stat-label">Completed</div>
                </div>
            </div>
        `;
    }
    
    generatePrintProject(project, isArchived = false) {
        const daysUntilDue = this.getDaysUntilDue(project.dueDate);
        const statusClass = `status-${project.status.replace(' ', '-')}`;
        
        // Get dependencies for this project
        let dependenciesHtml = '';
        if (project.dependencies && project.dependencies.length > 0) {
            const dependencyProjects = project.dependencies.map(depId => {
                const depProject = this.projects.find(p => p.id === depId) || 
                    (JSON.parse(localStorage.getItem('archivedProjects')) || []).find(p => p.id === depId);
                return depProject;
            }).filter(Boolean);
            
            if (dependencyProjects.length > 0) {
                dependenciesHtml = `
                    <div class="dependencies">
                        <h4>📋 Dependencies:</h4>
                        ${dependencyProjects.map(dep => `
                            <div class="dependency-item">
                                ${dep.title} (${dep.status?.replace('-', ' ') || 'Unknown'})
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }
        
        // Generate steps HTML
        let stepsHtml = '';
        if (project.steps && project.steps.length > 0) {
            const completedSteps = project.steps.filter(step => step.completed).length;
            stepsHtml = `
                <div class="steps">
                    <h4>📝 Steps (${completedSteps}/${project.steps.length} completed):</h4>
                    ${project.steps.map(step => `
                        <div class="step ${step.completed ? 'step-completed' : ''}">
                            <span class="step-checkbox">${step.completed ? '✓' : ''}</span>
                            ${step.text}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        return `
            <div class="project">
                <div class="project-title">${project.title}${isArchived ? ' 📦' : ''}</div>
                <span class="project-status ${statusClass}">${project.status.replace('-', ' ')}</span>
                ${project.details ? `<div class="project-details">${project.details}</div>` : ''}
                <div class="project-dates">
                    <strong>Start:</strong> ${this.formatDate(project.startDate)} | 
                    <strong>Due:</strong> ${this.formatDate(project.dueDate)} (${daysUntilDue})
                    ${isArchived && project.archivedAt ? `| <strong>Archived:</strong> ${this.formatDate(project.archivedAt)}` : ''}
                </div>
                ${dependenciesHtml}
                ${stepsHtml}
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${project.progress || 0}%"></div>
                </div>
                <div class="progress-text">${project.progress || 0}% Complete</div>
            </div>
        `;
    }
    
    
    sortProjectsByStatusAndDueDate(projects) {
        // Create a copy of the projects array to avoid mutating the original
        const projectsCopy = [...projects];
        
        // Define the priority order for statuses
        const statusPriority = {
            'in-progress': 1,
            'not-started': 2,
            'on-hold': 3,
            'completed': 4
        };
        
        return projectsCopy.sort((a, b) => {
            // First, sort by status priority (in-progress first, then not-started)
            const statusPriorityA = statusPriority[a.status] || 999;
            const statusPriorityB = statusPriority[b.status] || 999;
            
            if (statusPriorityA !== statusPriorityB) {
                return statusPriorityA - statusPriorityB;
            }
            
            // If statuses are the same, sort by due date (earliest first)
            const dueDateA = new Date(a.dueDate);
            const dueDateB = new Date(b.dueDate);
            
            return dueDateA - dueDateB;
        });
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

// Handle connection changes for real-time network updates
if ('connection' in navigator) {
    navigator.connection.addEventListener('change', () => dashboard.checkNetworkStatus());
}
if ('mozConnection' in navigator) {
    navigator.mozConnection.addEventListener('change', () => dashboard.checkNetworkStatus());
}
if ('webkitConnection' in navigator) {
    navigator.webkitConnection.addEventListener('change', () => dashboard.checkNetworkStatus());
}

