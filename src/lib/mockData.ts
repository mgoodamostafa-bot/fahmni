export interface Lesson {
  id: string;
  title: string;
  videoUrl: string;
  quizId: string;
  summary: string;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  subject: string;
  description: string;
  imageUrl?: string;
  coverImage?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  price: number;
  teacherName?: string;
  teacherId?: string;
  lessonCount?: number;
  rating?: number;
  status?: string;
  progress?: number;
  chapters?: Chapter[];
}

export const mockCourses: Course[] = [
  {
    id: '1',
    title: 'أساسيات البرمجة بلغة بايثون',
    subject: 'برمجة',
    description: 'كورس شامل لتعلم أساسيات البرمجة باستخدام لغة بايثون من الصفر حتى الاحتراف.',
    imageUrl: 'https://img.youtube.com/vi/rfscVS0vtbw/maxresdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
    thumbnailUrl: 'https://img.youtube.com/vi/rfscVS0vtbw/maxresdefault.jpg',
    progress: 25,
    price: 0,
    chapters: [],
  },
  {
    id: '2',
    title: 'مبادئ الهندسة المدنية',
    subject: 'هندسة',
    description: 'تعرف على أساسيات الهندسة المدنية والمواد المستخدمة في البناء.',
    imageUrl: 'https://img.youtube.com/vi/8S_P-J37584/maxresdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=8S_P-J37584',
    thumbnailUrl: 'https://img.youtube.com/vi/8S_P-J37584/maxresdefault.jpg',
    progress: 10,
    price: 0,
    chapters: [],
  },
  {
    id: '3',
    title: 'مقدمة في الذكاء الاصطناعي',
    subject: 'ذكاء اصطناعي',
    description: 'اكتشف عالم الذكاء الاصطناعي وتطبيقاته في حياتنا اليومية.',
    imageUrl: 'https://img.youtube.com/vi/JMUxmLyrCo0/maxresdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=JMUxmLyrCo0',
    thumbnailUrl: 'https://img.youtube.com/vi/JMUxmLyrCo0/maxresdefault.jpg',
    progress: 0,
    price: 0,
    chapters: [],
  },
];

export const recommendations: Course[] = [
  {
    id: '3',
    title: 'الرياضيات البحتة',
    subject: 'رياضيات',
    description: 'تفاضل وتكامل وجبر وهندسة فراغية.',
    imageUrl:
      'https://images.unsplash.com/photo-1509228468518-180dd48a5791?auto=format&fit=crop&q=80&w=1000',
    price: 0,
    chapters: [],
  },
];
