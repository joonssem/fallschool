// 교실 대소동(eraser-6bb35)과 같은 Firebase 프로젝트를 함께 쓴다.
// 이 게임의 데이터는 모두 `fallschool/` 아래에만 저장해 교실 대소동의 `rooms/`와 겹치지 않는다.
export const firebaseConfig = {
  apiKey: 'AIzaSyDuwihJonazmV0Ls_evqhnUT0BDkgtus9k',
  authDomain: 'eraser-6bb35.firebaseapp.com',
  databaseURL: 'https://eraser-6bb35-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'eraser-6bb35',
  storageBucket: 'eraser-6bb35.firebasestorage.app',
  messagingSenderId: '315372785185',
  appId: '1:315372785185:web:36086a9546a74108e69d60',
};

export const DB_ROOT = 'fallschool';

// 학생이 방을 만들지 못하게 막는 선생님 코드
// 페이지 소스에 들어가므로 비밀번호가 아니라 "학생이 실수로 방을 만들지 않게 하는" 정도의 장치다.
export const TEACHER_CODE = '코울슬로';
