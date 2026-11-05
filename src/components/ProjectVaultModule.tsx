/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  ProjectRecord, 
  TechChoiceItem, 
  MajorFeatureItem, 
  VerifiedContributionItem, 
  ProjectChallengeItem 
} from '@/lib/profileTypes';
import { getAllProjects, saveProject, deleteProject, INITIAL_PROJECTS, getActiveContext, saveActiveContext } from '@/lib/storage';
import { analyzeProjectFiles, CodeFileInput } from '@/lib/projectAnalyzer';
import { 
  FolderGit2, Plus, Trash2, CheckCircle2, ShieldCheck, 
  Layers, Database, Lock, Wrench, AlertTriangle, 
  Save, Upload, CheckSquare, Square, ChevronRight, Sparkles, FileCode, HelpCircle
} from 'lucide-react';

export const ProjectVaultModule: React.FC = () => {
  const [projects, setProjects] = useState<ProjectRecord[]>(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(INITIAL_PROJECTS[0]?.id || '');
  const [selectedProjectIdsForPractice, setSelectedProjectIdsForPractice] = useState<string[]>(['proj_echocopilot']);
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'contributions' | 'database_api' | 'challenges' | 'improvements'>('overview');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProjectName, setImportProjectName] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load from IndexedDB
  useEffect(() => {
    async function load() {
      const data = await getAllProjects();
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
      const ctx = await getActiveContext();
      setSelectedProjectIdsForPractice(ctx.selectedProjectIds || []);
    }
    load();
  }, []);

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const triggerNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSaveCurrentProject = async (updated: ProjectRecord) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    await saveProject(updated);
    triggerNotification(`Project "${updated.name}" saved to local IndexedDB.`);
  };

  const handleToggleProjectPractice = async (projectId: string) => {
    let updated: string[];
    if (selectedProjectIdsForPractice.includes(projectId)) {
      updated = selectedProjectIdsForPractice.filter(id => id !== projectId);
    } else {
      updated = [...selectedProjectIdsForPractice, projectId];
    }
    setSelectedProjectIdsForPractice(updated);
    const ctx = await getActiveContext();
    await saveActiveContext({ ...ctx, selectedProjectIds: updated });
    triggerNotification('Active project context for interview practice updated.');
  };

  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) {
      alert('You must keep at least one project in your vault.');
      return;
    }
    if (confirm('Are you sure you want to delete this project from your vault?')) {
      await deleteProject(id);
      const remaining = projects.filter(p => p.id !== id);
      setProjects(remaining);
      setSelectedProjectId(remaining[0].id);
      triggerNotification('Project removed from vault.');
    }
  };

  // Add a blank new project
  const handleCreateNewProject = async () => {
    const newProj: ProjectRecord = {
      id: `proj_${Date.now()}`,
      name: 'New Technical Project',
      tagline: 'High-impact software engineering project',
      problemStatement: '',
      targetUsers: '',
      architecture: 'Clean architecture with modular components.',
      technologyStack: [
        {
          name: 'Java',
          role: 'Backend',
          whyChosen: 'Selected for enterprise concurrency and type safety.',
          alternativesConsidered: 'Considered Node.js but needed strict type safety and JVM multithreading.'
        }
      ],
      majorFeatures: [
        {
          id: `feat_${Date.now()}`,
          name: 'Core Service',
          description: 'Primary domain execution service',
          implementationDetails: 'Engineered with comprehensive test suites.'
        }
      ],
      databaseSchemaAndApi: {
        databaseType: 'PostgreSQL Relational DB',
        majorEntitiesOrTables: ['users', 'transactions'],
        apiDesignPatterns: ['RESTful JSON API'],
        keyEndpoints: ['/api/v1/health']
      },
      securityAndPerformance: {
        securityMeasures: ['JWT Token Validation', 'Secret Sanitizer Protected'],
        performanceOptimizations: ['B-Tree Indexing on Foreign Keys']
      },
      verifiedContributions: [
        {
          id: `vc_${Date.now()}`,
          area: 'Core Architecture',
          description: 'Personally designed and implemented the main service modules.',
          isPersonallyImplemented: true
        }
      ],
      challengesAndSolutions: [],
      limitationsAndImprovements: {
        knownLimitations: [],
        whatWouldYouImproveIfRebuilt: 'If rebuilding today, I would decouple services using an event-driven message bus like Kafka.'
      },
      updatedAt: Date.now()
    };

    await saveProject(newProj);
    setProjects([newProj, ...projects]);
    setSelectedProjectId(newProj.id);
    triggerNotification('New project created.');
  };

  // Handle uploading code files to automatically extract architecture and sanitize secrets
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsAnalyzing(true);
    setImportWarnings([]);

    const fileInputs: CodeFileInput[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      try {
        const text = await f.text();
        fileInputs.push({
          name: f.name,
          path: f.webkitRelativePath || f.name,
          content: text
        });
      } catch (err) {
        console.warn('Error reading file:', f.name, err);
      }
    }

    const outcome = analyzeProjectFiles(importProjectName || 'Imported Codebase', fileInputs);

    if (outcome.warnings.length > 0) {
      setImportWarnings(outcome.warnings);
    }

    const importedProject: ProjectRecord = {
      id: `proj_${Date.now()}`,
      name: importProjectName || 'Imported Codebase',
      tagline: outcome.project.tagline || 'Imported Project',
      problemStatement: outcome.project.problemStatement || '',
      targetUsers: outcome.project.targetUsers || '',
      architecture: outcome.project.architecture || 'Modular fullstack architecture.',
      technologyStack: outcome.project.technologyStack || [],
      majorFeatures: outcome.project.majorFeatures || [],
      databaseSchemaAndApi: outcome.project.databaseSchemaAndApi || {
        databaseType: 'PostgreSQL Relational DB',
        majorEntitiesOrTables: [],
        apiDesignPatterns: ['RESTful JSON API']
      },
      securityAndPerformance: outcome.project.securityAndPerformance || {
        securityMeasures: ['Secret Sanitizer verified'],
        performanceOptimizations: []
      },
      verifiedContributions: outcome.project.verifiedContributions || [],
      challengesAndSolutions: [],
      limitationsAndImprovements: outcome.project.limitationsAndImprovements || {
        knownLimitations: [],
        whatWouldYouImproveIfRebuilt: 'I would enhance observability and automated CI/CD.'
      },
      updatedAt: Date.now()
    };

    await saveProject(importedProject);
    setProjects([importedProject, ...projects]);
    setSelectedProjectId(importedProject.id);
    setIsAnalyzing(false);
    setIsImportModalOpen(false);
    setImportProjectName('');
    triggerNotification(`Analyzed ${outcome.sanitizedFilesCount} files. Blocked ${outcome.blockedFilesCount} secret files.`);
  };

  if (!currentProject) return null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              Project Vault & Codebase Analyzer
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Secret Sanitized
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Stores verified contributions, architecture decisions, trade-offs, and technical solutions. Does NOT index secrets or .env files.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-teal-400 font-medium text-xs border border-zinc-700 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import / Analyze Code</span>
          </button>

          <button
            onClick={handleCreateNewProject}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs border border-zinc-700 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>

          <button
            onClick={() => handleSaveCurrentProject(currentProject)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-zinc-950 font-semibold text-xs shadow-md transition-all active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Project</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Grid: Projects Sidebar + Project Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Project List */}
        <div className="lg:col-span-1 space-y-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80 h-fit">
          <div className="flex items-center justify-between px-2 pt-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Your Projects</span>
            <span className="text-[11px] text-zinc-500 font-mono">{projects.length} saved</span>
          </div>

          <div className="space-y-2">
            {projects.map(p => {
              const isSelected = p.id === currentProject.id;
              const isPracticeActive = selectedProjectIdsForPractice.includes(p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-zinc-800/90 border-teal-500/50 shadow-sm'
                      : 'bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-zinc-200 truncate">{p.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleProjectPractice(p.id);
                      }}
                      title={isPracticeActive ? 'Active in interview practice context' : 'Inactive in interview practice'}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 ${
                        isPracticeActive
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}
                    >
                      {isPracticeActive ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                      <span>{isPracticeActive ? 'ACTIVE' : 'OFF'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-400 line-clamp-1 mb-2">{p.tagline || 'No tagline'}</p>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1 text-teal-400/80">
                      <CheckCircle2 className="w-3 h-3" />
                      {p.verifiedContributions?.filter(c => c.isPersonallyImplemented).length || 0} verified contribs
                    </span>
                    <span>{p.technologyStack?.length || 0} techs</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <span className="font-semibold text-zinc-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Secret Shield Active</span>
            </span>
            <p>
              Imported files are checked against secret filters. .env, API keys, passwords, and private certificates are automatically rejected.
            </p>
          </div>
        </div>

        {/* Right Detail Workspace */}
        <div className="lg:col-span-3 space-y-5 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80">
          {/* Workspace Title & Project Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={currentProject.name}
                  onChange={e => handleSaveCurrentProject({ ...currentProject, name: e.target.value })}
                  className="text-lg font-bold text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-teal-500 focus:outline-none px-1 py-0.5 rounded"
                />
              </div>
              <input
                type="text"
                value={currentProject.tagline || ''}
                onChange={e => handleSaveCurrentProject({ ...currentProject, tagline: e.target.value })}
                className="text-xs text-zinc-400 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-teal-500 focus:outline-none w-full px-1 py-0.5 mt-0.5"
                placeholder="Brief 1-sentence tagline describing what this project does..."
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteProject(currentProject.id)}
                className="p-2 rounded-xl bg-zinc-950 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-800 transition-colors"
                title="Delete this project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-800/80">
            {[
              { id: 'overview', label: 'Overview & Users' },
              { id: 'architecture', label: 'Architecture & Tech Stack' },
              { id: 'contributions', label: 'Verified Contributions' },
              { id: 'database_api', label: 'Database & API' },
              { id: 'challenges', label: 'Challenges & Bugs' },
              { id: 'improvements', label: 'Future Improvements' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW & USERS */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Problem Statement</label>
                <textarea
                  rows={3}
                  value={currentProject.problemStatement}
                  onChange={e => handleSaveCurrentProject({ ...currentProject, problemStatement: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500"
                  placeholder="What specific user problem or business inefficiency does this project solve?"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Users</label>
                <input
                  type="text"
                  value={currentProject.targetUsers}
                  onChange={e => handleSaveCurrentProject({ ...currentProject, targetUsers: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Software engineers preparing for interviews, enterprise data analysts, consumers..."
                />
              </div>

              {/* Major Features */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Major Features & Implementation</label>
                  <button
                    onClick={() => {
                      const newFeat: MajorFeatureItem = {
                        id: `feat_${Date.now()}`,
                        name: 'New Feature',
                        description: '',
                        implementationDetails: ''
                      };
                      handleSaveCurrentProject({
                        ...currentProject,
                        majorFeatures: [...(currentProject.majorFeatures || []), newFeat]
                      });
                    }}
                    className="text-[11px] text-teal-400 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Feature</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(currentProject.majorFeatures || []).map((feat, idx) => (
                    <div key={feat.id} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={feat.name}
                          onChange={e => {
                            const updated = [...currentProject.majorFeatures];
                            updated[idx].name = e.target.value;
                            handleSaveCurrentProject({ ...currentProject, majorFeatures: updated });
                          }}
                          className="font-semibold text-xs text-zinc-200 bg-transparent focus:outline-none border-b border-zinc-800 focus:border-teal-500"
                          placeholder="Feature Name"
                        />
                        <button
                          onClick={() => {
                            const updated = currentProject.majorFeatures.filter((_, i) => i !== idx);
                            handleSaveCurrentProject({ ...currentProject, majorFeatures: updated });
                          }}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={feat.description}
                        onChange={e => {
                          const updated = [...currentProject.majorFeatures];
                          updated[idx].description = e.target.value;
                          handleSaveCurrentProject({ ...currentProject, majorFeatures: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-teal-500"
                        placeholder="Feature summary and user experience..."
                      />
                      <input
                        type="text"
                        value={feat.implementationDetails}
                        onChange={e => {
                          const updated = [...currentProject.majorFeatures];
                          updated[idx].implementationDetails = e.target.value;
                          handleSaveCurrentProject({ ...currentProject, majorFeatures: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-teal-500"
                        placeholder="How it is technically implemented (APIs, algorithms, libraries used)..."
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ARCHITECTURE & TECH STACK (WHY CHOSEN) */}
          {activeTab === 'architecture' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">System Architecture Overview</label>
                <textarea
                  rows={3}
                  value={currentProject.architecture}
                  onChange={e => handleSaveCurrentProject({ ...currentProject, architecture: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Microservices architecture with Spring Boot backend, PostgreSQL database, React frontend, and Redis cache..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-medium text-zinc-300">Technology Stack & Selection Rationale</label>
                    <p className="text-[11px] text-zinc-500">
                      Explains why each technology was selected over alternatives (e.g., &quot;Why PostgreSQL instead of MongoDB?&quot;).
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newTech: TechChoiceItem = {
                        name: 'New Technology',
                        role: 'Backend',
                        whyChosen: '',
                        alternativesConsidered: ''
                      };
                      handleSaveCurrentProject({
                        ...currentProject,
                        technologyStack: [...currentProject.technologyStack, newTech]
                      });
                    }}
                    className="text-[11px] text-teal-400 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Tech</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {currentProject.technologyStack.map((tech, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tech.name}
                            onChange={e => {
                              const updated = [...currentProject.technologyStack];
                              updated[idx].name = e.target.value;
                              handleSaveCurrentProject({ ...currentProject, technologyStack: updated });
                            }}
                            className="font-bold text-xs text-teal-400 bg-transparent focus:outline-none border-b border-zinc-800 focus:border-teal-500"
                            placeholder="Tech Name (e.g. PostgreSQL)"
                          />
                          <select
                            value={tech.role}
                            onChange={e => {
                              const updated = [...currentProject.technologyStack];
                              updated[idx].role = e.target.value as any;
                              handleSaveCurrentProject({ ...currentProject, technologyStack: updated });
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400"
                          >
                            <option value="Frontend">Frontend</option>
                            <option value="Backend">Backend</option>
                            <option value="Database">Database</option>
                            <option value="Cache">Cache</option>
                            <option value="Infra">Infra</option>
                            <option value="Testing">Testing</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <button
                          onClick={() => {
                            const updated = currentProject.technologyStack.filter((_, i) => i !== idx);
                            handleSaveCurrentProject({ ...currentProject, technologyStack: updated });
                          }}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">Why was this technology chosen?</label>
                        <input
                          type="text"
                          value={tech.whyChosen}
                          onChange={e => {
                            const updated = [...currentProject.technologyStack];
                            updated[idx].whyChosen = e.target.value;
                            handleSaveCurrentProject({ ...currentProject, technologyStack: updated });
                          }}
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-teal-500"
                          placeholder="e.g. Needed strict relational integrity and JSONB querying..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">What alternatives were considered and rejected?</label>
                        <input
                          type="text"
                          value={tech.alternativesConsidered || ''}
                          onChange={e => {
                            const updated = [...currentProject.technologyStack];
                            updated[idx].alternativesConsidered = e.target.value;
                            handleSaveCurrentProject({ ...currentProject, technologyStack: updated });
                          }}
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-teal-500"
                          placeholder="e.g. Considered MongoDB, but lacked multi-table ACID transaction guarantees..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VERIFIED CONTRIBUTIONS (USER CONFIRMATION CHECKLIST) */}
          {activeTab === 'contributions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <span>Verified Personal Contributions</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Never claim team code as personal work. Check only the parts of this project that you personally implemented.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const newContrib: VerifiedContributionItem = {
                      id: `contrib_${Date.now()}`,
                      area: 'Feature / Module',
                      description: 'Personally wrote and debugged this module.',
                      isPersonallyImplemented: true
                    };
                    handleSaveCurrentProject({
                      ...currentProject,
                      verifiedContributions: [...(currentProject.verifiedContributions || []), newContrib]
                    });
                  }}
                  className="text-[11px] text-teal-400 flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Contribution</span>
                </button>
              </div>

              <div className="space-y-3">
                {(currentProject.verifiedContributions || []).map((contrib, idx) => (
                  <div
                    key={contrib.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      contrib.isPersonallyImplemented
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-zinc-950 border-zinc-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...currentProject.verifiedContributions];
                            updated[idx].isPersonallyImplemented = !updated[idx].isPersonallyImplemented;
                            handleSaveCurrentProject({ ...currentProject, verifiedContributions: updated });
                          }}
                          className="mt-0.5 text-emerald-400 hover:scale-110 transition-transform"
                        >
                          {contrib.isPersonallyImplemented ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-600" />
                          )}
                        </button>

                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={contrib.area}
                              onChange={e => {
                                const updated = [...currentProject.verifiedContributions];
                                updated[idx].area = e.target.value;
                                handleSaveCurrentProject({ ...currentProject, verifiedContributions: updated });
                              }}
                              className="font-bold text-xs text-zinc-200 bg-transparent focus:outline-none border-b border-transparent focus:border-teal-500"
                              placeholder="Contribution Area (e.g. Auth Engine)"
                            />
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              contrib.isPersonallyImplemented ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                            }`}>
                              {contrib.isPersonallyImplemented ? 'VERIFIED MINE' : 'TEAM WORK'}
                            </span>
                          </div>

                          <textarea
                            rows={2}
                            value={contrib.description}
                            onChange={e => {
                              const updated = [...currentProject.verifiedContributions];
                              updated[idx].description = e.target.value;
                              handleSaveCurrentProject({ ...currentProject, verifiedContributions: updated });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-teal-500"
                            placeholder="Detailed description of what you personally designed, coded, and tested..."
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const updated = currentProject.verifiedContributions.filter((_, i) => i !== idx);
                          handleSaveCurrentProject({ ...currentProject, verifiedContributions: updated });
                        }}
                        className="text-zinc-600 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE & API */}
          {activeTab === 'database_api' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Primary Database Type</label>
                  <input
                    type="text"
                    value={currentProject.databaseSchemaAndApi?.databaseType || ''}
                    onChange={e => handleSaveCurrentProject({
                      ...currentProject,
                      databaseSchemaAndApi: { ...currentProject.databaseSchemaAndApi, databaseType: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500"
                    placeholder="e.g. PostgreSQL Relational Database"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">API Design Patterns</label>
                  <input
                    type="text"
                    value={(currentProject.databaseSchemaAndApi?.apiDesignPatterns || []).join(', ')}
                    onChange={e => handleSaveCurrentProject({
                      ...currentProject,
                      databaseSchemaAndApi: {
                        ...currentProject.databaseSchemaAndApi,
                        apiDesignPatterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      }
                    })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500"
                    placeholder="e.g. RESTful JSON API, WebSocket, gRPC"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Major Database Entities / Tables (Comma-separated)</label>
                <input
                  type="text"
                  value={(currentProject.databaseSchemaAndApi?.majorEntitiesOrTables || []).join(', ')}
                  onChange={e => handleSaveCurrentProject({
                    ...currentProject,
                    databaseSchemaAndApi: {
                      ...currentProject.databaseSchemaAndApi,
                      majorEntitiesOrTables: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    }
                  })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500"
                  placeholder="e.g. users, sessions, orders, transactions, audit_logs"
                />
              </div>

              {/* Security & Performance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Security Measures</span>
                  </label>
                  <textarea
                    rows={3}
                    value={(currentProject.securityAndPerformance?.securityMeasures || []).join('\n')}
                    onChange={e => handleSaveCurrentProject({
                      ...currentProject,
                      securityAndPerformance: {
                        ...currentProject.securityAndPerformance,
                        securityMeasures: e.target.value.split('\n').filter(Boolean)
                      }
                    })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500 font-mono"
                    placeholder="e.g. JWT with rotation, RBAC, Rate Limiting..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-cyan-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Performance Considerations</span>
                  </label>
                  <textarea
                    rows={3}
                    value={(currentProject.securityAndPerformance?.performanceOptimizations || []).join('\n')}
                    onChange={e => handleSaveCurrentProject({
                      ...currentProject,
                      securityAndPerformance: {
                        ...currentProject.securityAndPerformance,
                        performanceOptimizations: e.target.value.split('\n').filter(Boolean)
                      }
                    })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500 font-mono"
                    placeholder="e.g. Redis caching, Connection pooling, Database indexing..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CHALLENGES & BUGS */}
          {activeTab === 'challenges' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100">Hardest Bugs & Technical Challenges in this Project</h3>
                  <p className="text-[11px] text-zinc-400">
                    Powers authentic answers to &quot;What was the most difficult technical problem you solved in this project?&quot;.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const newChal: ProjectChallengeItem = {
                      id: `pc_${Date.now()}`,
                      challenge: '',
                      solution: ''
                    };
                    handleSaveCurrentProject({
                      ...currentProject,
                      challengesAndSolutions: [...(currentProject.challengesAndSolutions || []), newChal]
                    });
                  }}
                  className="text-[11px] text-teal-400 flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Challenge</span>
                </button>
              </div>

              <div className="space-y-3">
                {(currentProject.challengesAndSolutions || []).map((chal, idx) => (
                  <div key={chal.id} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-teal-400">Challenge #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = currentProject.challengesAndSolutions.filter((_, i) => i !== idx);
                          handleSaveCurrentProject({ ...currentProject, challengesAndSolutions: updated });
                        }}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Technical Challenge / Bug</label>
                      <textarea
                        rows={2}
                        value={chal.challenge}
                        onChange={e => {
                          const updated = [...currentProject.challengesAndSolutions];
                          updated[idx].challenge = e.target.value;
                          handleSaveCurrentProject({ ...currentProject, challengesAndSolutions: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-teal-500"
                        placeholder="What technical problem occurred? (e.g. latency bottleneck, concurrency deadlocks)..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Your Solution & Resolution</label>
                      <textarea
                        rows={2}
                        value={chal.solution}
                        onChange={e => {
                          const updated = [...currentProject.challengesAndSolutions];
                          updated[idx].solution = e.target.value;
                          handleSaveCurrentProject({ ...currentProject, challengesAndSolutions: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-teal-500"
                        placeholder="How did you resolve it and what engineering trade-off was chosen?"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LIMITATIONS & WHAT WOULD YOU IMPROVE */}
          {activeTab === 'improvements' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-amber-400 mb-1">Known Limitations</label>
                <textarea
                  rows={2}
                  value={(currentProject.limitationsAndImprovements?.knownLimitations || []).join('\n')}
                  onChange={e => handleSaveCurrentProject({
                    ...currentProject,
                    limitationsAndImprovements: {
                      ...currentProject.limitationsAndImprovements,
                      knownLimitations: e.target.value.split('\n').filter(Boolean)
                    }
                  })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500 font-mono"
                  placeholder="e.g. Single database node without automated read replicas&#10;In-memory sessions instead of distributed Redis"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>What would you improve if you rebuilt your project?</span>
                </label>
                <textarea
                  rows={4}
                  value={currentProject.limitationsAndImprovements?.whatWouldYouImproveIfRebuilt || ''}
                  onChange={e => handleSaveCurrentProject({
                    ...currentProject,
                    limitationsAndImprovements: {
                      ...currentProject.limitationsAndImprovements,
                      whatWouldYouImproveIfRebuilt: e.target.value
                    }
                  })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500 leading-relaxed"
                  placeholder="Explain your architectural maturity: what patterns, message queues, microservices, or database optimizations would you adopt now?"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-zinc-800">
            <button
              onClick={() => handleSaveCurrentProject(currentProject)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-zinc-950 font-semibold text-xs shadow-md transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Project Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Import / Analyze Code Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-teal-400" />
                <span>Import & Analyze Project Code</span>
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Select source code files (`.java`, `.ts`, `.py`, `.sql`, etc.). The analyzer extracts architecture, tech stack, and proposed verified contributions while automatically excluding `.env`, secrets, and credentials.
            </p>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Project Name</label>
              <input
                type="text"
                value={importProjectName}
                onChange={e => setImportProjectName(e.target.value)}
                placeholder="e.g. Distributed Task Orchestrator"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Upload Source Files</label>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500 file:text-zinc-950 hover:file:bg-teal-600"
              />
            </div>

            {isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-teal-400 animate-pulse">
                <Sparkles className="w-4 h-4" />
                <span>Analyzing codebase and checking for secrets...</span>
              </div>
            )}

            {importWarnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1 max-h-32 overflow-y-auto">
                <span className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Security & Analysis Alerts:</span>
                </span>
                {importWarnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

