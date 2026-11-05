/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, ProjectRecord, TargetJobDescription, ActiveInterviewContext } from '@/lib/profileTypes';
import { 
  getUserProfile, 
  getAllProjects, 
  getAllJobDescriptions, 
  getActiveContext, 
  saveActiveContext 
} from '@/lib/storage';
import { ShieldCheck, CheckSquare, Square, ChevronDown, Sparkles, FolderGit2, User, Briefcase } from 'lucide-react';

export const ActiveContextSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [jobDescriptions, setJobDescriptions] = useState<TargetJobDescription[]>([]);
  const [activeContext, setActiveContext] = useState<ActiveInterviewContext>({
    selectedProjectIds: [],
    practiceTrack: 'technical'
  });

  const loadData = async () => {
    const p = await getUserProfile();
    setProfile(p);
    const prs = await getAllProjects();
    setProjects(prs);
    const jds = await getAllJobDescriptions();
    setJobDescriptions(jds);
    const ctx = await getActiveContext();
    setActiveContext(ctx);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleProject = async (projId: string) => {
    let updated: string[];
    if (activeContext.selectedProjectIds.includes(projId)) {
      updated = activeContext.selectedProjectIds.filter(id => id !== projId);
    } else {
      updated = [...activeContext.selectedProjectIds, projId];
    }
    const newCtx = { ...activeContext, selectedProjectIds: updated };
    setActiveContext(newCtx);
    await saveActiveContext(newCtx);
  };

  const handleSelectJob = async (jobId: string | undefined) => {
    const newCtx = { ...activeContext, targetJobId: jobId };
    setActiveContext(newCtx);
    await saveActiveContext(newCtx);
  };

  const selectedCount = activeContext.selectedProjectIds.length;

  return (
    <div className="relative">
      <button
        onClick={() => {
          loadData();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-xs text-zinc-300 border border-zinc-700/80 transition-all shadow-inner"
        title="Choose active career profile and projects used for AI answers"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-medium text-emerald-400">Context:</span>
        <span className="text-zinc-200 font-semibold truncate max-w-[120px]">
          {profile?.name || 'Profile'}
        </span>
        <span className="text-[11px] text-zinc-500">
          ({selectedCount} proj)
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3.5 animate-fadeIn backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-zinc-100">Active Interview Context</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Local IndexedDB
            </span>
          </div>

          {/* Active Profile Info */}
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <User className="w-3.5 h-3.5 text-teal-400" />
              <span>{profile?.name || 'Candidate'}</span>
            </div>
            <p className="text-[11px] text-zinc-400">{profile?.title || 'Full-Stack Software Engineer'}</p>
          </div>

          {/* Active Projects Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Selected Projects for Interview</span>
              </span>
              <span className="text-[10px] text-zinc-500">{selectedCount} active</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {projects.map(p => {
                const isChecked = activeContext.selectedProjectIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleToggleProject(p.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs border transition-all ${
                      isChecked
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      )}
                      <span className="font-medium truncate">{p.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {p.verifiedContributions.filter(c => c.isPersonallyImplemented).length} contribs
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Job Selection */}
          {jobDescriptions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                <span>Target Job Description</span>
              </span>

              <select
                value={activeContext.targetJobId || ''}
                onChange={e => handleSelectJob(e.target.value || undefined)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="">General Preparation (No specific JD)</option>
                {jobDescriptions.map(jd => (
                  <option key={jd.id} value={jd.id}>
                    {jd.company} - {jd.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-800 flex justify-end">
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

