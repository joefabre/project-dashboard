// Archived Projects JavaScript
class ArchivedDashboard {
    constructor() {
        this.archivedProjects = JSON.parse(localStorage.getItem('archivedProjects')) || [];
        
        this.init();
    }

    init() {
        this.updateDateTime();
        this.checkNetworkStatus();
        this.setupEventListeners();
        this.renderArchivedProjects();
        
        // Update date/time every second
        setInterval(() => this.updateDateTime(), 1000);
        
        // Check network status every 30 seconds
        setInterval(() => this.checkNetworkStatus(), 30000);
    }

    setupEventListeners() {
        const exportBtn = document.getElementById('export-archived-btn');
        const helpBtn = document.getElementById('help-btn');

        exportBtn.addEventListener('click', () => this.exportArchivedData());
        helpBtn.addEventListener('click', () => this.openHelp());
    }

    openHelp() {
        window.open('help.html', '_blank');
    }

    deleteArchivedProject(projectId) {
        if (confirm('Are you sure you want to permanently delete this archived project?')) {
            this.archivedProjects = this.archivedProjects.filter(p => p.id !== projectId);
            this.saveArchivedToStorage();
            this.renderArchivedProjects();
        }
    }

    unarchiveProject(projectId) {
        if (confirm('Move this project back to the active dashboard?')) {
            const project = this.archivedProjects.find(p => p.id === projectId);
            if (project) {
                // Remove from archived
                this.archivedProjects = this.archivedProjects.filter(p => p.id !== projectId);
                
                // Change status back to in-progress
                project.status = 'in-progress';
                project.unarchivedAt = new Date().toISOString();
                
                // Add to active projects
                let activeProjects = JSON.parse(localStorage.getItem('projects')) || [];
                activeProjects.push(project);
                localStorage.setItem('projects', JSON.stringify(activeProjects));
                
                // Save archived projects
                this.saveArchivedToStorage();
                this.renderArchivedProjects();
                
                // Show success message
                this.showNotification('Project moved back to active dashboard! 📤', 'success');
            }
        }
    }

    saveArchivedToStorage() {
        try {
            localStorage.setItem('archivedProjects', JSON.stringify(this.archivedProjects));
            console.log('Archived data saved successfully to localStorage');
        } catch (error) {
            console.error('Failed to save archived data:', error);
            alert('Warning: Failed to save archived data.');
        }
    }

    renderArchiveStats() {
        const archiveStatsContainer = document.getElementById('archive-stats');
        const totalArchived = this.archivedProjects.length;
        
        if (totalArchived === 0) {
            archiveStatsContainer.innerHTML = `
                <div class="stat-card completed">
                    <span class="stat-icon">📦</span>
                    <div class="stat-number">0</div>
                    <div class="stat-label">Archived Projects</div>
                </div>
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #636e72;">
                    <p>No archived projects yet. Complete projects on the main dashboard to see them here.</p>
                </div>
            `;
            return;
        }
        
        // Calculate time-based stats
        const now = new Date();
        const thisMonth = this.archivedProjects.filter(p => {
            const archived = new Date(p.archivedAt);
            return archived.getMonth() === now.getMonth() && archived.getFullYear() === now.getFullYear();
        }).length;
        
        const thisYear = this.archivedProjects.filter(p => {
            const archived = new Date(p.archivedAt);
            return archived.getFullYear() === now.getFullYear();
        }).length;
        
        archiveStatsContainer.innerHTML = `
            <div class="stat-card completed">
                <span class="stat-icon">📦</span>
                <div class="stat-number">${totalArchived}</div>
                <div class="stat-label">Total Archived</div>
            </div>
            <div class="stat-card completed">
                <span class="stat-icon">📅</span>
                <div class="stat-number">${thisMonth}</div>
                <div class="stat-label">This Month</div>
            </div>
            <div class="stat-card completed">
                <span class="stat-icon">🗓️</span>
                <div class="stat-number">${thisYear}</div>
                <div class="stat-label">This Year</div>
            </div>
        `;
    }
    
    renderArchivedProjects() {
        this.renderArchiveStats();
        
        const container = document.getElementById('archived-projects-container');
        
        if (this.archivedProjects.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: rgba(255,255,255,0.8);">
                    <h2>No archived projects</h2>
                    <p>Complete projects on the main dashboard to see them archived here!</p>
                    <button onclick="window.location.href='index.html'" class="btn-primary" style="margin-top: 1rem;">
                        Go to Dashboard
                    </button>
                </div>
            `;
            return;
        }

        // Sort by most recently archived
        const sortedProjects = [...this.archivedProjects].sort((a, b) => 
            new Date(b.archivedAt) - new Date(a.archivedAt)
        );

        container.innerHTML = sortedProjects.map(project => this.createArchivedProjectCard(project)).join('');
    }

    createArchivedProjectCard(project) {
        const archivedDate = this.formatDate(project.archivedAt);
        const completedSteps = project.steps ? project.steps.filter(step => step.completed).length : 0;
        const totalSteps = project.steps ? project.steps.length : 0;
        
        return `
            <div class="project-card archived-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${project.title}</h3>
                        <span class="project-status status-completed">Completed</span>
                    </div>
                </div>
                
                <div class="project-details">${project.details}</div>
                
                <div class="project-dates">
                    <span><strong>Started:</strong> ${this.formatDate(project.startDate)}</span>
                    <span><strong>Completed:</strong> ${archivedDate}</span>
                </div>
                
                ${totalSteps > 0 ? `
                <div class="archived-steps-summary">
                    <div class="steps-summary-header">
                        <span>📋 Project Steps</span>
                        <span class="steps-count">${completedSteps}/${totalSteps} completed</span>
                    </div>
                    <div class="steps-preview">
                        ${project.steps.slice(0, 3).map(step => `
                            <div class="step-preview-item ${step.completed ? 'completed' : ''}">
                                <span class="step-indicator">${step.completed ? '✅' : '⬜'}</span>
                                <span class="step-text">${step.text}</span>
                            </div>
                        `).join('')}
                        ${project.steps.length > 3 ? `<div class="step-preview-item">... and ${project.steps.length - 3} more steps</div>` : ''}
                    </div>
                </div>
                ` : '<div class="archived-steps-summary"><p style="color: #666; font-style: italic;">No steps defined for this project</p></div>'}
                
                <div class="project-actions">
                    <button class="btn-small btn-edit" onclick="archivedDashboard.unarchiveProject('${project.id}')">
                        📤 Unarchive
                    </button>
                    <button class="btn-small btn-delete" onclick="archivedDashboard.deleteArchivedProject('${project.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
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
    
    exportArchivedData() {
        try {
            const exportData = {
                archivedProjects: this.archivedProjects,
                exportDate: new Date().toISOString(),
                version: '1.0',
                source: 'Joe\'s Status Dashboard - Archived Projects'
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `archived-projects-backup-${dateStr}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Archived data exported successfully! 📤', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Failed to export archived data. ❌', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
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
        
        document.body.appendChild(notification);
        
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

// Initialize the archived dashboard when the page loads
let archivedDashboard;
document.addEventListener('DOMContentLoaded', () => {
    archivedDashboard = new ArchivedDashboard();
});

// Handle online/offline events
window.addEventListener('online', () => archivedDashboard.checkNetworkStatus());
window.addEventListener('offline', () => archivedDashboard.checkNetworkStatus());

