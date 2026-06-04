export type RootStackParamList = {
  TeacherLogin: undefined;
  TeacherDashboard:
    | { username?: string; name?: string; moduleLabel?: string; openProfilePanel?: boolean }
    | undefined;
  TeacherAdmissionDashboard:
    | { username?: string; name?: string; moduleLabel?: string }
    | undefined;
  TeacherAdmissionRegister:
    | { username?: string; name?: string; moduleLabel?: string }
    | undefined;
  TeacherAdmissionAdmission:
    | { username?: string; name?: string; moduleLabel?: string }
    | undefined;
  TeacherAdmissionEnrollment:
    | { username?: string; name?: string; moduleLabel?: string }
    | undefined;
  TeacherAdmissionCommunication:
    | { username?: string; name?: string; moduleLabel?: string }
    | undefined;
  TeacherAdmissionTestCounselling:
    | { username?: string; name?: string; moduleLabel?: string }
    | undefined;
  TeacherAdmissionReports:
    | { username?: string; name?: string; moduleLabel?: string }
    | undefined;
  TeacherAttendance: { username?: string; name?: string } | undefined;
  TeacherBehaviour: { username?: string; name?: string } | undefined;
  TeacherTimetable: { username?: string; name?: string } | undefined;
  TeacherEventMediaUpload: { username?: string; name?: string } | undefined;
  TeacherTickets: { username?: string; name?: string } | undefined;
  TeacherSalary: { username?: string; name?: string } | undefined;
  TeacherCalender: { username?: string; name?: string } | undefined;
  TeacherDetails: { username?: string; name?: string } | undefined;
  TeacherHomework: { username?: string; name?: string } | undefined;
  TeacherHomeworkUpload: { username?: string; name?: string } | undefined;
  TeacherQuestionPaperGeneration: { username?: string; name?: string } | undefined;
  TeacherLeaveRequest: { username?: string; name?: string } | undefined;
  TeacherChatAndEvents: { username?: string; name?: string } | undefined;
  TeacherEventCalendar: { username?: string; name?: string } | undefined;
  TeacherCounselling: { username?: string; name?: string } | undefined;
  TeacherModuleSummary: { username?: string; name?: string; moduleLabel?: string } | undefined;
  TopicOfDay: { username?: string; name?: string } | undefined;
  ParentDashboard: { username?: string; name?: string } | undefined;
  ParentAcademic: { username?: string; name?: string } | undefined;
  ParentAttendance: { username?: string; name?: string } | undefined;
  ParentFees: { username?: string; name?: string } | undefined;
  ParentHomework: { username?: string; name?: string } | undefined;
  ParentTimetable: { username?: string; name?: string } | undefined;
  ParentCalender: { username?: string; name?: string } | undefined;
  ParentPhotos: { username?: string; name?: string } | undefined;
  ParentLiveChatTicket: { username?: string; name?: string } | undefined;
  ParentHomepage: { username?: string; name?: string } | undefined;
  ParentDetails: { username?: string; name?: string } | undefined;
  AdminDashboard: undefined;
  AccountantDashboard: { username?: string; name?: string } | undefined;
  ChiefDashboard: { username?: string; name?: string } | undefined;
  BusManagerDashboard: undefined;
  BusDashboard: undefined;
  BusDriverDashboard: undefined;
  AcademicStudent: undefined;
  AcademicTeacher: undefined;
  ExamManagement: undefined;
  Meetings: undefined;
  ChiefAnnouncements: undefined;
  ChiefAttendanceAndPayroll: undefined;
};
