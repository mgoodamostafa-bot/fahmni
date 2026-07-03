/**
 * Firebase Analytics Utility
 * Provides analytics tracking functions for the application
 */

// Event types for type safety
export type AnalyticsEventType =
  | 'page_view'
  | 'login'
  | 'logout'
  | 'sign_up'
  | 'enrollment'
  | 'course_view'
  | 'lesson_start'
  | 'lesson_complete'
  | 'exam_start'
  | 'exam_complete'
  | 'search'
  | 'download'
  | 'share';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  payload?: Record<string, string | number | boolean>;
}

// Simple analytics implementation (can be replaced with Firebase Analytics)
class Analytics {
  private static instance: Analytics;
  private events: AnalyticsEvent[] = [];

  private constructor() {}

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  track(type: AnalyticsEventType, payload?: Record<string, string | number | boolean>) {
    const event: AnalyticsEvent = { type, payload };
    this.events.push(event);

    // Log to console in development
    if ((process.env.NODE_ENV !== 'production')) {
      console.log('[Analytics]', type, payload);
    }

    // Here you would typically send to Firebase Analytics
    // Example: logEvent(analytics, type, payload);
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}

export const analytics = Analytics.getInstance();

// Helper functions for common tracking scenarios
export const trackPageView = (page: string) => {
  analytics.track('page_view', { page });
};

export const trackLogin = (method: string) => {
  analytics.track('login', { method });
};

export const trackLogout = () => {
  analytics.track('logout');
};

export const trackCourseView = (courseId: string, courseTitle: string) => {
  analytics.track('course_view', { courseId, courseTitle });
};

export const trackLessonStart = (lessonId: string, courseId: string) => {
  analytics.track('lesson_start', { lessonId, courseId });
};

export const trackLessonComplete = (lessonId: string, courseId: string) => {
  analytics.track('lesson_complete', { lessonId, courseId });
};

export const trackExamStart = (examId: string) => {
  analytics.track('exam_start', { examId });
};

export const trackExamComplete = (examId: string, score: number) => {
  analytics.track('exam_complete', { examId, score });
};

export const trackSearch = (query: string, resultsCount: number) => {
  analytics.track('search', { query, resultsCount });
};
