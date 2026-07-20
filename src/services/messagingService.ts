import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  orderBy, 
  serverTimestamp, 
  doc,
  increment,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';

export interface Conversation {
  id: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  parentPhone: string;
  lastMessage: string;
  lastMessageAt: any;
  unreadByTeacher: number;
  unreadByParent: number;
  tenantId?: string;
  createdAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderRole: 'teacher' | 'parent';
  senderName: string;
  text: string;
  read: boolean;
  createdAt: any;
}

export const messagingService = {
  // Create or get existing conversation
  async getOrCreateConversation(
    teacherId: string,
    teacherName: string,
    studentId: string,
    studentName: string,
    parentPhone: string,
    tenantId?: string
  ): Promise<string> {
    const db = getTenantDb();
    const convoId = `${teacherId}_${studentId}`;
    const convoRef = doc(db, 'conversations', convoId);
    
    const convoSnap = await getDoc(convoRef);
    if (convoSnap.exists()) {
      return convoId;
    }
    
    // Create new conversation document
    await setDoc(convoRef, {
      teacherId,
      teacherName,
      studentId,
      studentName,
      parentPhone,
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      unreadByTeacher: 0,
      unreadByParent: 0,
      tenantId: tenantId || null,
      createdAt: serverTimestamp()
    });
    
    return convoId;
  },

  // Send message
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderRole: 'teacher' | 'parent',
    senderName: string,
    text: string
  ): Promise<void> {
    const db = getTenantDb();
    
    // Add message doc to subcollection
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      senderId,
      senderRole,
      senderName,
      text,
      read: false,
      createdAt: serverTimestamp()
    });
    
    // Update conversation metadata
    const convoRef = doc(db, 'conversations', conversationId);
    const updateData: any = {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
    };
    
    if (senderRole === 'teacher') {
      updateData.unreadByParent = increment(1);
    } else {
      updateData.unreadByTeacher = increment(1);
    }
    
    await updateDoc(convoRef, updateData);
  },

  // Subscribe to conversations list for a teacher (listens to all tenant chats in real time)
  subscribeToTeacherConversations(
    teacherId: string,
    callback: (convos: Conversation[]) => void
  ): () => void {
    const db = getTenantDb();
    const q = collection(db, 'conversations');
    
    return onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];

      // Sort in memory by lastMessageAt descending
      convos.sort((a, b) => {
        const tA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : new Date(a.lastMessageAt || 0).getTime();
        const tB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : new Date(b.lastMessageAt || 0).getTime();
        return tB - tA;
      });

      callback(convos);
    }, (error) => {
      console.error('Error listening to teacher conversations:', error);
    });
  },

  // Subscribe to conversations list for parent (by studentId)
  subscribeToParentConversations(
    studentId: string,
    callback: (convos: Conversation[]) => void
  ): () => void {
    const db = getTenantDb();
    const q = query(
      collection(db, 'conversations'),
      where('studentId', '==', studentId),
      orderBy('lastMessageAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];
      callback(convos);
    }, (error) => {
      console.error('Error listening to parent conversations:', error);
    });
  },

  // Subscribe to messages in a conversation
  subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    const db = getTenantDb();
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      callback(messages);
    }, (error) => {
      console.error('Error listening to messages:', error);
    });
  },

  // Mark messages as read
  async markMessagesAsRead(
    conversationId: string,
    role: 'teacher' | 'parent'
  ): Promise<void> {
    const db = getTenantDb();
    const convoRef = doc(db, 'conversations', conversationId);
    
    const updateData: any = {};
    if (role === 'teacher') {
      updateData.unreadByTeacher = 0;
    } else {
      updateData.unreadByParent = 0;
    }
    
    await updateDoc(convoRef, updateData);
  },

  // Get total unread count for teacher
  getUnreadCountForTeacher(
    teacherId: string,
    callback: (count: number) => void
  ): () => void {
    const db = getTenantDb();
    const q = query(
      collection(db, 'conversations'),
      where('teacherId', '==', teacherId)
    );
    
    return onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        count += (data.unreadByTeacher || 0);
      });
      callback(count);
    });
  }
};
