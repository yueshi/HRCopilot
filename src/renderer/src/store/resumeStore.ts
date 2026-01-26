import { create } from "zustand";
import type { ResumeData } from "../../../shared/types";

interface Pagination {
  current: number;
  pageSize: number;
  total: number;
  pages: number;
}

interface ResumeState {
  resumes: ResumeData[];
  loading: boolean;
  pagination: Pagination;
  error: string | null;

  // Actions
  setResumes: (resumes: ResumeData[]) => void;
  addResume: (resume: ResumeData) => void;
  updateResume: (id: number, updates: Partial<ResumeData>) => void;
  removeResume: (id: number) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setPagination: (pagination: Partial<Pagination>) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const defaultPagination: Pagination = {
  current: 1,
  pageSize: 10,
  total: 0,
  pages: 0,
};

export const useResumeStore = create<ResumeState>((set, get) => ({
  resumes: [],
  loading: false,
  pagination: defaultPagination,
  error: null,

  setResumes: (resumes) => set({ resumes }),

  addResume: (resume) =>
    set((state) => ({
      resumes: [resume, ...(state.resumes || [])],
      pagination: {
        ...(state.pagination || defaultPagination),
        total: (state.pagination || defaultPagination).total + 1,
      },
    })),

  updateResume: (id, updates) =>
    set((state) => ({
      resumes: (state.resumes || []).map((resume) =>
        resume.id === id ? { ...resume, ...(updates || {}) } : resume,
      ),
    })),

  removeResume: async (id) => {
    try {
      const state = get();
      const updatedResumes = state.resumes.filter(
        (resume) => resume.id !== id,
      );
      set({
        resumes: updatedResumes,
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "删除简历简历失败",
      });
      throw error;
    }
  },

  setLoading: (loading) => set({ loading }),

  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    })),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),
}));
