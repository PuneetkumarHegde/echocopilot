/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  EducationRecord, 
  SkillCategoryGroup, 
  WorkExperienceRecord, 
  AchievementOrCertRecord, 
  RealChallengeRecord 
} from '@/lib/profileTypes';
import { getUserProfile, saveUserProfile, INITIAL_USER_PROFILE } from '@/lib/storage';
import { 
  User, GraduationCap, Code2, Target, Briefcase, Award, 
  ShieldAlert, Wrench, Plus, Trash2, Edit3, Save, Check, 
  AlertCircle, Download, Upload, RefreshCw, ChevronRight, HelpCircle
} from 'lucide-react';

export const ProfileModule: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [activeTab, setActiveTab] = useState<'overview' | 'education' | 'skills' | 'goals' | 'experience' | 'achievements' | 'strengths' | 'challenges'>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load from IndexedDB
  useEffect(() => {
    async function load() {
      const data = await getUserProfile();
      setProfile(data);
    }
    load();
  }, []);

  const triggerSaveNotification = (msg: string) => {
    setIsSaved(true);
    setStatusMessage(msg);
    setTimeout(() => {
      setIsSaved(false);
      setStatusMessage(null);
    }, 2800);
  };

  const handleSaveProfile = async (updated: UserProfile) => {
    setProfile(updated);
    await saveUserProfile(updated);
    triggerSaveNotification('Profile changes saved securely to local IndexedDB.');
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `echocopilot-profile-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          await handleSaveProfile(parsed);
          triggerSaveNotification('Profile successfully imported!');
        }
      } catch {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Education handlers
  const addEducation = () => {
    const newEdu: EducationRecord = {
      id: `edu_${Date.now()}`,
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      gpaOrGrade: '',
      reasonForDegree: ''
    };
    const updated = { ...profile, education: [...profile.education, newEdu] };
    handleSaveProfile(updated);
  };

  const updateEducation = (id: string, field: keyof EducationRecord, value: any) => {
    const updated = {
      ...profile,
      education: profile.education.map(e => e.id === id ? { ...e, [field]: value } : e)
    };
    setProfile(updated);
  };

  const removeEducation = (id: string) => {
    const updated = {
      ...profile,
      education: profile.education.filter(e => e.id !== id)
    };
    handleSaveProfile(updated);
  };

  // Experience handlers
  const addExperience = () => {
    const newExp: WorkExperienceRecord = {
      id: `work_${Date.now()}`,
      company: '',
      role: '',
      type: 'Full-time',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
      achievements: [''],
      technologiesUsed: []
    };
    const updated = { ...profile, workExperience: [...profile.workExperience, newExp] };
    handleSaveProfile(updated);
  };

  const updateExperience = (id: string, field: keyof WorkExperienceRecord, value: any) => {
    const updated = {
      ...profile,
      workExperience: profile.workExperience.map(w => w.id === id ? { ...w, [field]: value } : w)
    };
    setProfile(updated);
  };

  const removeExperience = (id: string) => {
    const updated = {
      ...profile,
      workExperience: profile.workExperience.filter(w => w.id !== id)
    };
    handleSaveProfile(updated);
  };

  // Challenges handlers
  const addChallenge = () => {
    const newChal: RealChallengeRecord = {
      id: `chal_${Date.now()}`,
      title: '',
      context: '',
      technicalProblem: '',
      solutionAndFix: '',
      lessonsLearned: ''
    };
    const updated = { ...profile, realChallenges: [...profile.realChallenges, newChal] };
    handleSaveProfile(updated);
  };

  const updateChallenge = (id: string, field: keyof RealChallengeRecord, value: any) => {
    const updated = {
      ...profile,
      realChallenges: profile.realChallenges.map(c => c.id === id ? { ...c, [field]: value } : c)
    };
    setProfile(updated);
  };

  const removeChallenge = (id: string) => {
    const updated = {
      ...profile,
      realChallenges: profile.realChallenges.filter(c => c.id !== id)
    };
    handleSaveProfile(updated);
  };

  // Achievements handlers
  const addAchievement = () => {
    const newAch: AchievementOrCertRecord = {
      id: `ach_${Date.now()}`,
      title: '',
      issuerOrEvent: '',
      date: '',
      type: 'Certification',
      description: ''
    };
    const updated = { ...profile, hackathonsAndCerts: [...profile.hackathonsAndCerts, newAch] };
    handleSaveProfile(updated);
  };

  const updateAchievement = (id: string, field: keyof AchievementOrCertRecord, value: any) => {
    const updated = {
      ...profile,
      hackathonsAndCerts: profile.hackathonsAndCerts.map(a => a.id === id ? { ...a, [field]: value } : a)
    };
    setProfile(updated);
  };

  const removeAchievement = (id: string) => {
    const updated = {
      ...profile,
      hackathonsAndCerts: profile.hackathonsAndCerts.filter(a => a.id !== id)
    };
    handleSaveProfile(updated);
  };

  const navigationTabs = [
    { id: 'overview', label: 'Overview & Basics', icon: <User className="w-4 h-4" /> },
    { id: 'education', label: 'Education & Degree', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'skills', label: 'Technical Skills & Rationale', icon: <Code2 className="w-4 h-4" /> },
    { id: 'goals', label: 'Career Goals & Domains', icon: <Target className="w-4 h-4" /> },
    { id: 'experience', label: 'Work & Internships', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'challenges', label: 'Real Challenges Solved', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'strengths', label: 'Strengths & Growth', icon: <Wrench className="w-4 h-4" /> },
    { id: 'achievements', label: 'Hackathons & Certs', icon: <Award className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                Personal Career Profile
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Local IndexedDB
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Powers authentic, first-person interview answers and dynamic question generation. Missing fields are never hallucinated.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleSaveProfile(profile)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md transition-all active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Profile</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs border border-zinc-700/60 transition-all"
            title="Download JSON backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs border border-zinc-700/60 transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            {statusMessage}
          </span>
        </div>
      )}

      {/* Main Layout: Left Navigation + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sub-Nav */}
        <div className="lg:col-span-1 space-y-1 bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80 h-fit">
          <div className="px-3 py-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Profile Sections
          </div>
          {navigationTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {tab.icon}
                  <span>{tab.label}</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-600'}`} />
              </button>
            );
          })}

          <div className="mt-4 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authenticity Rule</span>
            </div>
            <p>
              Leave any field blank if not applicable. The AI will never make up facts, and will politely ask for details if an interview question requires them.
            </p>
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-3 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 min-h-[500px]">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Personal & Career Overview</h2>
                <p className="text-xs text-zinc-400">High-level candidate identity and elevator summary.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Puneet Kumar"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Headline / Target Title</label>
                  <input
                    type="text"
                    value={profile.title}
                    onChange={e => setProfile({ ...profile, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Full-Stack Software Engineer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="puneet@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Location / Timezone (Optional)</label>
                  <input
                    type="text"
                    value={profile.location || ''}
                    onChange={e => setProfile({ ...profile, location: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Bangalore, India (IST)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Professional Executive Summary</label>
                <textarea
                  rows={4}
                  value={profile.summary || ''}
                  onChange={e => setProfile({ ...profile, summary: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
                  placeholder="Short, authentic summary of your engineering passion, primary stack, and what drives you..."
                />
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => handleSaveProfile(profile)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs transition-all shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Overview</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EDUCATION */}
          {activeTab === 'education' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Education & Academic Background</h2>
                  <p className="text-xs text-zinc-400">Stores institutions, degrees, and your real reason for choosing your specialization.</p>
                </div>
                <button
                  onClick={addEducation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-medium border border-zinc-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Degree</span>
                </button>
              </div>

              {profile.education.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                  <GraduationCap className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No education entries yet. Click &quot;Add Degree&quot; to add your academic background.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {profile.education.map((edu, idx) => (
                    <div key={edu.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400">Degree #{idx + 1}</span>
                        <button
                          onClick={() => removeEducation(edu.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                          title="Remove degree"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Degree Title</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={e => updateEducation(edu.id, 'degree', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Bachelor of Technology"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Field of Study / Major</label>
                          <input
                            type="text"
                            value={edu.fieldOfStudy}
                            onChange={e => updateEducation(edu.id, 'fieldOfStudy', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Computer Science & Engineering"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Institution / University</label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={e => updateEducation(edu.id, 'institution', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. University of Technology"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1">Year</label>
                            <input
                              type="text"
                              value={edu.endDate || ''}
                              onChange={e => updateEducation(edu.id, 'endDate', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                              placeholder="e.g. 2024"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1">GPA / Honors</label>
                            <input
                              type="text"
                              value={edu.gpaOrGrade || ''}
                              onChange={e => updateEducation(edu.id, 'gpaOrGrade', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                              placeholder="e.g. 3.8 / 4.0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Explicit Question: Why did you choose this degree or specialization? */}
                      <div>
                        <label className="block text-[11px] font-medium text-emerald-400 mb-1 flex items-center gap-1.5">
                          <HelpCircle className="w-3 h-3" />
                          <span>Why did you choose your degree or specialization?</span>
                        </label>
                        <textarea
                          rows={2}
                          value={edu.reasonForDegree || ''}
                          onChange={e => updateEducation(edu.id, 'reasonForDegree', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
                          placeholder="Your real motivation (e.g. interest in distributed systems, operating system design, math foundations)..."
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveProfile(profile)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Education</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TECHNICAL SKILLS & RATIONALE */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Technical Skills & Technology Rationale</h2>
                <p className="text-xs text-zinc-400">
                  Add reasons why you chose specific languages (like Java) or databases to power authentic answers like &quot;Why did you choose Java?&quot;.
                </p>
              </div>

              {profile.technicalSkills.map((group, groupIdx) => (
                <div key={group.category} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{group.category}</span>
                    <button
                      onClick={() => {
                        const newSkillName = prompt('Enter new skill name:');
                        if (!newSkillName?.trim()) return;
                        const newSkills = [...group.skills, { name: newSkillName.trim(), level: 'Intermediate' as const, rationale: '' }];
                        const updatedGroups = [...profile.technicalSkills];
                        updatedGroups[groupIdx].skills = newSkills;
                        handleSaveProfile({ ...profile, technicalSkills: updatedGroups });
                      }}
                      className="text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Skill</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {group.skills.map((skill, sIdx) => (
                      <div key={skill.name} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-200">{skill.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                              {skill.level || 'Intermediate'}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const updatedSkills = group.skills.filter((_, idx) => idx !== sIdx);
                              const updatedGroups = [...profile.technicalSkills];
                              updatedGroups[groupIdx].skills = updatedSkills;
                              handleSaveProfile({ ...profile, technicalSkills: updatedGroups });
                            }}
                            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">
                            Why did you choose {skill.name}? / How does it support your career goals?
                          </label>
                          <input
                            type="text"
                            value={skill.rationale || ''}
                            onChange={e => {
                              const updatedGroups = [...profile.technicalSkills];
                              updatedGroups[groupIdx].skills[sIdx].rationale = e.target.value;
                              setProfile({ ...profile, technicalSkills: updatedGroups });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder={`e.g. I chose ${skill.name} because...`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  onClick={() => handleSaveProfile(profile)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Skills & Rationale</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CAREER GOALS & DOMAINS */}
          {activeTab === 'goals' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Career Goals & Domain Advantages</h2>
                <p className="text-xs text-zinc-400">
                  Articulate why you are pursuing specific roles, companies, or leveraging specialized backgrounds (e.g. Cybersecurity).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Target Roles (Comma-separated)</label>
                  <input
                    type="text"
                    value={profile.careerGoals.targetRoles.join(', ')}
                    onChange={e => {
                      const roles = e.target.value.split(',').map(r => r.trim()).filter(Boolean);
                      setProfile({
                        ...profile,
                        careerGoals: { ...profile.careerGoals, targetRoles: roles }
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="Full-Stack Engineer, Backend Engineer, Distributed Systems Engineer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Short-Term Career Goal (Next 1–2 Years)</label>
                  <textarea
                    rows={2}
                    value={profile.careerGoals.shortTermGoals || ''}
                    onChange={e => {
                      setProfile({
                        ...profile,
                        careerGoals: { ...profile.careerGoals, shortTermGoals: e.target.value }
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Master high-concurrency microservices and take ownership of critical service reliability..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Long-Term Career Vision (3–5+ Years)</label>
                  <textarea
                    rows={2}
                    value={profile.careerGoals.longTermGoals || ''}
                    onChange={e => {
                      setProfile({
                        ...profile,
                        careerGoals: { ...profile.careerGoals, longTermGoals: e.target.value }
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Lead system architecture as a Staff Engineer or Principal Architect in distributed cloud platforms..."
                  />
                </div>

                {/* Explicit Cybersecurity / Domain Advantage */}
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                  <label className="block text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>How does your cybersecurity or special domain background help in software development?</span>
                  </label>
                  <textarea
                    rows={3}
                    value={profile.careerGoals.cybersecurityOrDomainAdvantage || ''}
                    onChange={e => {
                      setProfile({
                        ...profile,
                        careerGoals: { ...profile.careerGoals, cybersecurityOrDomainAdvantage: e.target.value }
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
                    placeholder="Explain how your domain knowledge provides defense-in-depth, security reviews, or architectural foresight..."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSaveProfile(profile)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Career Goals</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: WORK EXPERIENCE & INTERNSHIPS */}
          {activeTab === 'experience' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Work Experience & Internships</h2>
                  <p className="text-xs text-zinc-400">Stores verified roles, responsibilities, and quantified achievements.</p>
                </div>
                <button
                  onClick={addExperience}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-medium border border-zinc-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Experience</span>
                </button>
              </div>

              {profile.workExperience.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                  <Briefcase className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No work experience logged yet. Click &quot;Add Experience&quot; to log your internships or full-time roles.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {profile.workExperience.map((exp, idx) => (
                    <div key={exp.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400">Experience #{idx + 1}</span>
                        <button
                          onClick={() => removeExperience(exp.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Company / Organization</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={e => updateExperience(exp.id, 'company', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Acme Labs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Job Role / Title</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={e => updateExperience(exp.id, 'role', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Software Engineering Intern"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Role Type</label>
                          <select
                            value={exp.type}
                            onChange={e => updateExperience(exp.id, 'type', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="Internship">Internship</option>
                            <option value="Full-time">Full-time</option>
                            <option value="Part-time">Part-time</option>
                            <option value="Contract">Contract</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Dates / Duration</label>
                          <input
                            type="text"
                            value={exp.startDate ? `${exp.startDate} - ${exp.endDate || 'Present'}` : ''}
                            onChange={e => updateExperience(exp.id, 'startDate', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. May 2023 - Aug 2023"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">Core Responsibilities</label>
                        <textarea
                          rows={2}
                          value={exp.description}
                          onChange={e => updateExperience(exp.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="Summary of what your team built and what you owned..."
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">Key Quantified Achievements (1 per line)</label>
                        <textarea
                          rows={3}
                          value={exp.achievements.join('\n')}
                          onChange={e => updateExperience(exp.id, 'achievements', e.target.value.split('\n'))}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed font-mono"
                          placeholder="e.g. Reduced p99 latency from 850ms to 92ms by redesigning composite indexes."
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveProfile(profile)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Experience</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: REAL CHALLENGES & BUGS SOLVED */}
          {activeTab === 'challenges' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Real Challenges & Outages Solved</h2>
                  <p className="text-xs text-zinc-400">
                    Powers authentic answers to &quot;What was the most difficult technical problem you solved?&quot; and &quot;What trade-offs did you consider?&quot;.
                  </p>
                </div>
                <button
                  onClick={addChallenge}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-medium border border-zinc-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Challenge</span>
                </button>
              </div>

              {profile.realChallenges.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No production challenges logged yet. Click &quot;Add Challenge&quot; to log your real engineering triage stories.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {profile.realChallenges.map((chal, idx) => (
                    <div key={chal.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400">Challenge #{idx + 1}</span>
                        <button
                          onClick={() => removeChallenge(chal.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">Challenge Title / Incident Name</label>
                        <input
                          type="text"
                          value={chal.title}
                          onChange={e => updateChallenge(chal.id, 'title', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. Redis Connection Pool Starvation During Load Spike"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Context & Symptoms</label>
                          <textarea
                            rows={3}
                            value={chal.context}
                            onChange={e => updateChallenge(chal.id, 'context', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="What broke? (e.g. API timeouts, CPU spike, 500 error rates)..."
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Root Cause / Technical Problem</label>
                          <textarea
                            rows={3}
                            value={chal.technicalProblem}
                            onChange={e => updateChallenge(chal.id, 'technicalProblem', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="Exact technical bottleneck or bug identified..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Solution & Code Fix</label>
                          <textarea
                            rows={3}
                            value={chal.solutionAndFix}
                            onChange={e => updateChallenge(chal.id, 'solutionAndFix', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="How did you resolve it? (e.g. index overhaul, connection pool tuning)..."
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Trade-offs Considered & Lessons</label>
                          <textarea
                            rows={3}
                            value={chal.lessonsLearned}
                            onChange={e => updateChallenge(chal.id, 'lessonsLearned', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="What alternatives were rejected and what did you learn?"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveProfile(profile)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Challenges</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: STRENGTHS & GROWTH */}
          {activeTab === 'strengths' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Strengths & Growth Areas</h2>
                <p className="text-xs text-zinc-400">
                  Powers authentic answers to &quot;What are your technical strengths?&quot; and &quot;What are your areas for improvement?&quot;.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1">
                    Key Technical Strengths (1 per line)
                  </label>
                  <textarea
                    rows={4}
                    value={profile.strengthsAndWeaknesses.technicalStrengths.join('\n')}
                    onChange={e => {
                      const lines = e.target.value.split('\n').filter(Boolean);
                      setProfile({
                        ...profile,
                        strengthsAndWeaknesses: {
                          ...profile.strengthsAndWeaknesses,
                          technicalStrengths: lines
                        }
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed font-mono"
                    placeholder="e.g. Relational schema design and indexing in PostgreSQL&#10;Building robust REST APIs in Spring Boot"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-amber-400">
                      Areas for Improvement & Active Remediation Steps
                    </label>
                    <button
                      onClick={() => {
                        const updated = {
                          ...profile,
                          strengthsAndWeaknesses: {
                            ...profile.strengthsAndWeaknesses,
                            areasForImprovement: [
                              ...profile.strengthsAndWeaknesses.areasForImprovement,
                              { area: '', remediationAction: '' }
                            ]
                          }
                        };
                        handleSaveProfile(updated);
                      }}
                      className="text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Growth Area</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {profile.strengthsAndWeaknesses.areasForImprovement.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Area / Skill</label>
                          <input
                            type="text"
                            value={item.area}
                            onChange={e => {
                              const updated = [...profile.strengthsAndWeaknesses.areasForImprovement];
                              updated[idx].area = e.target.value;
                              setProfile({
                                ...profile,
                                strengthsAndWeaknesses: {
                                  ...profile.strengthsAndWeaknesses,
                                  areasForImprovement: updated
                                }
                              });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Kubernetes production clustering"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] text-zinc-400 mb-1">What you are doing to improve</label>
                            <button
                              onClick={() => {
                                const updated = profile.strengthsAndWeaknesses.areasForImprovement.filter((_, i) => i !== idx);
                                handleSaveProfile({
                                  ...profile,
                                  strengthsAndWeaknesses: {
                                    ...profile.strengthsAndWeaknesses,
                                    areasForImprovement: updated
                                  }
                                });
                              }}
                              className="text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={item.remediationAction}
                            onChange={e => {
                              const updated = [...profile.strengthsAndWeaknesses.areasForImprovement];
                              updated[idx].remediationAction = e.target.value;
                              setProfile({
                                ...profile,
                                strengthsAndWeaknesses: {
                                  ...profile.strengthsAndWeaknesses,
                                  areasForImprovement: updated
                                }
                              });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Completing CKA certification labs and deploying Helm charts"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSaveProfile(profile)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Strengths & Growth</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: HACKATHONS & CERTS */}
          {activeTab === 'achievements' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Hackathons, Achievements & Certifications</h2>
                  <p className="text-xs text-zinc-400">Validated awards, hackathon wins, and professional certificates.</p>
                </div>
                <button
                  onClick={addAchievement}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-medium border border-zinc-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Achievement</span>
                </button>
              </div>

              {profile.hackathonsAndCerts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                  <Award className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No achievements recorded yet. Click &quot;Add Achievement&quot; to log hackathons, awards, or certs.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.hackathonsAndCerts.map((ach, idx) => (
                    <div key={ach.id} className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400">Entry #{idx + 1}</span>
                        <button
                          onClick={() => removeAchievement(ach.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-zinc-400 mb-1">Title / Award</label>
                          <input
                            type="text"
                            value={ach.title}
                            onChange={e => updateAchievement(ach.id, 'title', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. AWS Certified Cloud Practitioner"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Type</label>
                          <select
                            value={ach.type}
                            onChange={e => updateAchievement(ach.id, 'type', e.target.value as any)}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="Certification">Certification</option>
                            <option value="Hackathon">Hackathon</option>
                            <option value="Award">Award</option>
                            <option value="Publication">Publication</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Issuer / Event Organization</label>
                          <input
                            type="text"
                            value={ach.issuerOrEvent}
                            onChange={e => updateAchievement(ach.id, 'issuerOrEvent', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Amazon Web Services"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Date</label>
                          <input
                            type="text"
                            value={ach.date}
                            onChange={e => updateAchievement(ach.id, 'date', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Nov 2023"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Description / Project Built</label>
                        <input
                          type="text"
                          value={ach.description || ''}
                          onChange={e => updateAchievement(ach.id, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="Brief description of what was achieved..."
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveProfile(profile)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Achievements</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

