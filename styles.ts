import { StyleSheet, Dimensions, Platform } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Logic to detect tablet for layout adjustments
const isTablet = SCREEN_WIDTH > 768;

// Scale font based on standard iPhone 11/12 width (375px) with a cap for tablets
const scaleFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  const newSize = isTablet ? size * (scale * 0.8) : size * scale;
  return Math.round(Platform.OS === 'ios' ? newSize : newSize - 1);
};

const MAIN_LAYOUT_HEIGHT = isTablet ? hp('35%') : hp('40%');

export const globalStyles = StyleSheet.create({
  // --- Dropdowns & Inputs ---
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#f6f6f7',
    height: hp('4%'),
    width: wp('30%'), // Dynamic width
    justifyContent: 'center',
  },
  dropdownText: {
    color: '#111827',
    fontSize: 12,
    textAlign: 'center',
  },
  decisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  dropdownBox: {
    flex: 1,
    height: 40,
    backgroundColor: '#4A4A4A',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginRight: 10,
  },

  reasonInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#4A4A4A',
    borderRadius: 8,
    color: '#FFF',
    paddingHorizontal: 10,
    fontSize: 12,
    marginRight: 10,
  },
  sendButton: {
    width: 45,
    height: 45,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFC0CB', // Light pink border as seen in mockup
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 20,
    color: '#4A90E2', // Blue arrow icon
    transform: [{ rotate: '-20deg' }], // Slight tilt like the mockup
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f6f6f7',
    borderRadius: 10,
    marginHorizontal: 10,
    marginBottom: 15,
    overflow: 'hidden',
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: 'gray',
    alignItems: 'center',
    marginTop: 10,
  },

  activeTab: {
    backgroundColor: '#0088cc',
  },

  tabText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },

  tabContent: {
    padding: 15,
  },

  tabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  switchActive: {
    backgroundColor: '#404040',
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 45,
    marginRight: 10,
  },

  dateText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 12,
  },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },

  uploadText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },

  leftContainer: {
    flex: 1,
  },

  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  reasonBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 45,
  },

  footerWrapper: {
    position: 'absolute',
    // Using hp ensures the distance scales with screen height
    bottom: hp('1%'),
    left: 0,
    right: 0,
    // Add horizontal padding so buttons don't touch screen edges
    paddingHorizontal: wp('4%'),
    // Higher zIndex ensures it stays above cards
    zIndex: 20,
  },
  footerWrapper1: {
    position: 'absolute',
    bottom: hp('-1%'), // 1% from the very bottom of the screen
    left: 0,
    right: 0,
    alignItems: 'center', // Centers children horizontally
    justifyContent: 'center',
    zIndex: 99, // Ensures it stays above all other content
  },
  picker: {
    width: '100%',
    height: 80,

    padding: 0,
    margin: 0,

    color: '#111827',
  },

  leaveTypeText: {
    fontSize: 11,
    color: '#b00020',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  dropdownRow: { flexDirection: 'row', alignItems: 'center', marginTop: '2%' },

  leftColumn1: { width: '35%', height: '80%' },

  dropdownWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // ⬅️ push to right
    paddingHorizontal: 10,
  },

  shadow45: {
    elevation: 30,
    width: 200,

    // iOS shadow
    shadowColor: '#000',

    borderColor: '#000',
  },
  notchContainer: {
    position: 'absolute',
    // Using top 50% combined with a fixed translateY of half the container's height
    // ensures pixel-perfect vertical centering across all DP densities.
    top: '50%',
    left: 0,
    right: 0,

    // Height should be relative to the card it sits in, but hp('5%')
    // is a good standard for "finger-sized" touch targets.
    height: hp('5%'),

    // Instead of -hp('2.5%'), using a calculation based on the specific
    // height of this container prevents 'sub-pixel' shifting.
    transform: [{ translateY: -(hp('5%') / 2) }],

    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    opacity: 0,

    // Added pointerEvents: 'box-none' in the component props
    // so it doesn't block touches to elements behind it.
  },
  leftNotch: {
    width: wp('5.5%'),
    height: hp('5%'),
    backgroundColor: 'transparent',
    borderTopRightRadius: 25,
    borderBottomRightRadius: 25,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: 'transparent',
    position: 'absolute',
    left: -3,
    zIndex: 3,
  },
  rightNotch: {
    width: wp('5.5%'),
    height: hp('5%'),
    backgroundColor: 'transparent',
    borderTopLeftRadius: 25,
    borderBottomLeftRadius: 25,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'transparent',
    position: 'absolute',
    right: -3,
    zIndex: 3,
  },
  notchContainer6: {
    position: 'absolute', // ✅ KEY CHANGE
    top: '32%', // ✅ vertical center of card
    left: 0,
    right: 0,

    transform: [{ translateY: -20 }], // half of height (40 / 2)

    height: 40,
    width: '100%',
    marginHorizontal: -0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '', // hides card border
    zIndex: 10,
  },

  notchContainer7: {
    position: 'absolute', // ✅ KEY CHANGE
    top: '82%', // ✅ vertical center of card
    left: 0,
    right: 0,

    transform: [{ translateY: -20 }], // half of height (40 / 2)

    height: 40,
    width: '100%',
    marginHorizontal: -0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '', // hides card border
    zIndex: 10,
  },
  middleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 10,
  },
  // ENLARGED NOTCH DESIGN
  notchContainer1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    height: 40,
    width: '100%',
    marginTop: -10,
    backgroundColor: '#FFFFFF',
    marginHorizontal: -0.5,
    zIndex: 2,
  },
  dashedLine: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderColor: 'transparent',
    borderStyle: 'dashed',
    marginHorizontal: 25,
  },
  dashedLine1: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderColor: 'transparent',
    borderStyle: 'dashed',
    marginHorizontal: 25,
  },
  notchContainer3: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '16%', // or bottom: 0 if you want at bottom
    transform: [{ translateY: -20 }],
    height: 40,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    alignItems: 'center', // 🔑 centers children vertically
    backgroundColor: 'transparent',
    elevation: 0,
  },
  // notchContainer3: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginVertical: 10,
  //   height: 40,
  //   width: '100%',
  // marginTop:0,
  //  backgroundColor: 'transparent',
  //   elevation: 0,
  //   marginHorizontal: -14,
  //   marginRight: -14,
  //   zIndex: 2,
  // },
  notchContainer4: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '62%', // or bottom: 0 if you want at bottom
    transform: [{ translateY: -20 }],
    height: 40,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    alignItems: 'center', // 🔑 centers children vertically
  },
  notchContainer8: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '15%', // or bottom: 0 if you want at bottom
    transform: [{ translateY: -20 }],
    height: 40,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    alignItems: 'center', // 🔑 centers children vertically
  },
  notchContainer5: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '78%', // or bottom: 0 if you want at bottom
    transform: [{ translateY: -20 }],
    height: 40,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    alignItems: 'center', // 🔑 centers children vertically
    marginTop: 6,
  },
  middleSection: {
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  dropdown: {
    backgroundColor: '#EAF2FF',
    borderRadius: 20,
    width: 140,
    overflow: 'hidden',
  },

  message: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  schoolCode: {
    fontSize: 16,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#777',
  },
  errorText: {
    fontSize: 14,
    color: 'red',
  },

  bigGrade: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 25,
  },
  attendanceBorder: { borderWidth: 2, borderColor: '#000' }, // Updated

  // Typography

  viewLinkBlack: {
    fontSize: 12,
    color: '#000',
    marginTop: 5,
    textAlign: 'left',
  },
  viewLinkCenter: {
    fontSize: 12,
    color: '#000',
    marginTop: 5,
    textAlign: 'center',
  },
  viewLink2: { fontSize: 12, color: '#000', marginTop: 5, textAlign: 'center' },
  percentText: {
    fontSize: 11,
    color: '#000',
    textAlign: 'right',
    marginTop: -5,
  },
  viewLink1: {
    fontSize: 12,
    color: '#0a3d62',
    marginTop: 5,
    textAlign: 'left',
  },
  viewLink: { fontSize: 12, color: '#000', marginTop: 5, textAlign: 'left' },

  viewLinkBlue1: {
    fontSize: 12,
    color: '#0a3d62',
    marginTop: 20,
    textAlign: 'left',
  },
  viewLinkBlack1: {
    fontSize: 12,
    color: '#000',
    marginTop: 20,
    textAlign: 'left',
  },
  viewReportButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D8DC',
  },
  viewReportButtonText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0A3D62',
  },

  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginLeft: 10, // left alignment
    marginBottom: 8,
  },

  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 0,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  box: {
    width: 12,
    height: 12,
    marginRight: 5,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#000',
  },

  rightColumn1: {
    flex: 1,
    marginLeft: 10,
    height: '76%', // ✅ reduce by 5%
  }, // Footer
  footerNotes: {
    marginTop: '8%',
    paddingHorizontal: 12,
    paddingBottom: 16,
    height: '20%',
  },
  footerNotes1: {
    marginTop: 2,
    paddingHorizontal: 12,
    paddingBottom: 16,
    height: '20%',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  bullet: { fontSize: 13, flex: 1 },
  blackBtn: {
    backgroundColor: '#404040',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 15,
  },
  btnText: { color: '#F2F2F2', fontSize: 11, fontWeight: 'bold' },
  combinedSection1: { paddingTop: 55 },

  subText: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },

  combinedCard1: {
    flex: 1, // 🔥 fills entire 45% height
    backgroundColor: '#f6f6f7',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#ccc',
    position: 'relative',
    padding: 4,
  },
  smallCard1: {
    flex: 1, // 🔥 each card takes 50% height
    backgroundColor: '#f6f6f7',
    borderRadius: 25,
    padding: 12,
    marginBottom: 10,

    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,

    borderWidth: 1,
    borderColor: '#ccc',
  },

  notchContainer2: {
    position: 'absolute',
    top: '50%',
    left: -2, // 🔧 slightly overlap border
    right: -1,

    transform: [{ translateY: -20 }], // half of height

    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FFFFFF', // hides border cleanly
    zIndex: 10,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f6f7',
      
    padding:0,
    margin:0,
  },
  scrollView: {
    flex: 1,
    padding: 0,
  },
  container: {
    padding: 6,
    marginTop: Platform.OS === 'ios' ? 0 : 10,
 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent1: {
    width: '90%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
  },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  modalCloseText: {
    fontSize: 16,
    color: 'red',
  },
  modalTitle1: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
  },
  modalCard: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  // --- Header & Dropdowns ---
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop:60,
  },
  headerText: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#000',
  },
  inputSelecterWrapper: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginVertical: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    width: wp('80%'),
    height: 49,
    justifyContent: 'center',
  },
  selectAllButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  selectAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    alignItems: 'center',
  },
  gridContainer: {
    height: '50%', // ✅ FIXED HEIGHT (adjust as needed)
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: '1%',
    marginTop: '15%',
  },

  gridScrollContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },

  studentContainer: {
    width: '32%', // ✅ 4 items per row
    alignItems: 'center',
    marginBottom: 16,
  },

  studentIcon: {
    backgroundColor: '#f0f0f0',
    padding: 5,
    borderRadius: wp('10%'),
    marginBottom: 5,
    width: wp('18%'),
    height: wp('18%'),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  studentPhoto: {
    width: wp('18%'),
    height: wp('18%'),
    borderRadius: wp('9%'),
  },
  defaultIcon: {
    backgroundColor: '#e0e0e0',
  },
  picker1: {
    width: '100%',
  },
  submitButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 10,
    width: wp('80%'),
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: 'red',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    alignSelf: 'flex-end', // Moves the button to the right
    marginEnd: 10, // Adjust spacing
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },

  inputField: {
    height: 40,
    width: 250,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginTop: 1,
    paddingHorizontal: 10,
    color: 'black',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  input1: {
    borderRadius: 20,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    marginVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#333',
    fontSize: scaleFont(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    width: wp('70%'), // Responsive width
    height: hp('6%'),
  },
  submitButtonStyle: {
    backgroundColor: 'rgb(160, 180, 182)',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  presentIcon: {
    backgroundColor: 'gray',
  },
  absentIcon: {
    backgroundColor: '#F36B79',
  },
  studentName: {
    fontWeight: '500',
    textAlign: 'center',
    color: 'black',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  leaveOption: {
    fontSize: 18,
    color: '#007bff',
    paddingVertical: 15,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  // --- Main Layout Columns ---
  // --- Layout Columns ---
  mainLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    width: '100%',
    height: hp('21%'),
    gap: 10,
  },
  leftColumn: {
    flex: 0.45,
    marginRight: wp('2%'),
  },
  rightColumn: {
    flex: 0.55,
  },
  mainLayout1: {
    flexDirection: 'row',
    height: MAIN_LAYOUT_HEIGHT,
    marginBottom: 14,
  },
  leftColumn3: {
    flex: 1,
    justifyContent: 'flex-start',
  },

  // --- Cards ---
  smallCard: {
    backgroundColor: '#f6f6f7',
    borderRadius: wp('5%'),
    padding: wp('4%'),
    marginBottom: hp('1.5%'),

    // Ensure the card is never too small for its text
    height: isTablet ? hp('12%') : hp('12%'),

    // This allows the card to grow if the text inside is long (e.g., translated languages)

    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ccc',

    // Android Shadow
    elevation: 4,

    // iOS Shadow (Standardizing across both platforms)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  combinedCard: {
    backgroundColor: '#f6f6f7',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ccc',
    flex: 1,
    height: isTablet ? hp('25%') : hp('26%'),
    position: 'relative',
  },
  buttonRow: {
    flexDirection: 'row',
    // justifyContent: 'center',   // ⬅️ center group
    alignItems: 'center',
    paddingHorizontal: 20, // ⬅️ left & right gap
    marginTop: '-2%',
    gap: 10,
    justifyContent: 'space-between',
  },

  buttonRow1: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '-2%',
    paddingHorizontal: 15,
  },
  selectBtn: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 30,
    width: '45%',
    alignItems: 'center',
    marginRight: 10, // ⬅️ gap between buttons
  },
  selectBtn2: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    width: '35%',
    alignItems: 'center',
    marginRight: 10,
  },
  selectBtn1: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 30,
    width: '45%',
    alignItems: 'center',
    marginRight: 5, // ⬅️ gap between buttons
  },

  submitBtn: {
    backgroundColor: '#000',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 30,
    width: '45%',
    alignItems: 'center',
    marginLeft: 10, // ⬅️ gap between buttons
  },
  submitBtn1: {
    backgroundColor: '#f6f6f7',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 30,
    width: '45%',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },

  selectBtnText: {
    fontWeight: '600',
    color: '#000',
    fontSize: 12,
  },

  submitBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },

  overallBg: {
    backgroundColor: '#FFFFFF',
  },

  combinedSection: {
    padding: SCREEN_WIDTH * 0.035,
    flex: 1,
    justifyContent: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6, // space between running & lagging
  },
  // --- Responsive Notches ---

  // --- Performance/Syllabus Tabs ---
  syllabusContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    marginTop: 5,
    paddingBottom: 15,
    height: SCREEN_HEIGHT * 0.5,
  },
  syllabusContainer1: {
    backgroundColor: '#f6f6f7',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#f6f6f7',
    marginTop: hp('4%'),
    paddingTop: hp('2%'),

    // Using hp ensures the container always takes up 54% of the
    // viewable screen height across all device densities.
    height: hp('53%'),
  },
  AccademicTeacher: {
    backgroundColor: '#f6f6f7',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#f6f6f7',
    marginTop: hp('4%'),  
    paddingTop: hp('2%'),

    // Using hp ensures the container always takes up 54% of the
    // viewable screen height across all device densities.
    height: hp('55%'),
  },
  syllabusContainer2: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    marginTop: hp('1%'),
    paddingBottom: hp('2%'),

    // Using hp ensures the container always takes up 54% of the
    // viewable screen height across all device densities.
    height: hp('55%'),
  },
  syllabusContainer4: {
    backgroundColor: '#f6f6f7',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: hp('1%'),
    paddingBottom: hp('2%'),

    // Using hp ensures the container always takes up 54% of the
    // viewable screen height across all device densities.
    height: hp('60%'),
  },
  syllabusContainer3: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    marginTop: hp('1%'),
    paddingBottom: hp('2%'),

    // Using hp ensures the container always takes up 54% of the
    // viewable screen height across all device densities.
    height: hp('42%'),
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    marginTop: '-4%',
  },

  extraButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: '-4%',
    paddingHorizontal: 10,
  },

  extraBtn: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },

  extraBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  activeTabBackground: {
    backgroundColor: '#404040',
  },
  inactiveTabText: {
    color: '#000',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#F2F2F2',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
  },

  // --- Chart Area ---
  syllabusContent: { padding: 15 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -20,
  },
  teacherName: { fontSize: scaleFont(13), color: '#666' },
  classText: { fontSize: scaleFont(12), color: '#555' },
  chartFrame: {
    flexDirection: 'row',
    height: '15%',
    marginTop: 60,
  },
  yAxis: { justifyContent: 'space-between', paddingBottom: 20, marginRight: 8 },
  axisLabel: { fontSize: 10, color: '#555' },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: '8%',
  },
  chartFrame1: {
    flexDirection: 'row',
    height: SCREEN_HEIGHT * 0.12,
    marginTop: 30,
    alignItems: 'flex-start', // 👈 pushes content to top
  },
  chartWrapper: {
    flexDirection: 'column',
    marginTop: 25,
  },

  chartArea1: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  barPair: {
    alignItems: 'flex-end', // aligns bars from bottom
    flexDirection: 'row', // makes bars side by side
    width: SCREEN_WIDTH * 0.12,
  },
  bar: {
    width: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  runBar: { backgroundColor: '#F06292' },
  lagBar: { backgroundColor: '#2D4496' },
  barName: {
    position: 'absolute',
    bottom: -22,
    fontSize: 8,
    fontWeight: 'bold',
  },
  blueName: {
    position: 'absolute',
    color: '#348beeff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  topRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  leftButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  messageBtnTall: {
    width: 60,
    height: 70, // taller look
    backgroundColor: '#f6f6f7',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
    elevation: 4,
    borderColor: '#F06292',
    borderWidth: 2,
  },
  selectBtn3: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EAF2FF',
  },

  messageLayout: {
    flexDirection: 'row',
    alignItems: 'stretch', // 👈 makes icon match height of left column
    marginTop: 10,
  },
  centerIconRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  messageBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0088CC', // Telegram blue
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },

  messageIcon: {
    color: '#F2F2F2',
    fontSize: 20,
  },

  lessonContainer: {
    marginTop: 12,
  },

  lessonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  topicText: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },

  // --- Typography ---
  cardTitle: { fontSize: scaleFont(13), fontWeight: 'bold', color: '#000' },
  cardTitleBlack: {
    fontSize: scaleFont(11),
    fontWeight: 'bold',
    color: '#000',
  },
  bigGradeBlack: {
    fontSize: scaleFont(15),
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 15,
  },
  bigNum: {
    fontSize: scaleFont(30),
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: -10,
  },
  percentTextBlack: {
    fontSize: scaleFont(11),
    color: '#000',
    textAlign: 'right',
  },
  viewLinkBlue: { fontSize: 11, color: '#0a3d62', fontWeight: '600' },
  viewLinkBlue3: { fontSize: 11, color: '#0a3d62', marginTop: 0 },
  bigNum1: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: -10,
  },
  iconImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    backgroundColor: '#f6f6f7',
    marginTop: 10,
  },

  receiptContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  receiptRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  receiptLabel: {
    fontSize: 10,
    color: '#555',
  },
  receiptValue: {
    fontSize: 10,
    color: '#555',
  },
});

export const attendanceModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 10,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    height: SCREEN_HEIGHT * 0.58,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: Math.round((SCREEN_WIDTH / 375) * 16),
    fontWeight: '600',
    color: '#000',
  },
});

export const attendanceStyles = StyleSheet.create({
  page: {
    padding: 0,
    gap: 14,
    backgroundColor: '#f6f6f7',
    flexGrow: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#7E7363',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    color: '#171717',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666058',
    maxWidth: 300,
  },
  heroBadge: {
    minWidth: 72,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#232323',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  heroBadgeLabel: {
    color: '#D5D5D5',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    borderRadius: 24,
    backgroundColor: 'transparent',
borderWidth: 1,
borderColor: '#f6f6f7',
    padding: 10,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#333',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  classSectionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  classSectionField: {
    flex: 1,
    minWidth: 0,
  },
  classSectionBadgeWrap: {
    flexShrink: 0,
    paddingBottom: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#333',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  attendanceDropdownContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#f6f6f7',
    height: hp('4%'),
    justifyContent: 'center',
  },
  dropdownShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: '#111827',
    fontSize: 13,
    paddingVertical: 0,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f6f7',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f6f7',
    borderWidth: 1,
    borderColor: '#CCC',
  },
  secondaryButtonText: {
    color: '#3E392F',
    fontSize: 13,
    fontWeight: '800',
  },
  gridCard: {
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0,
    minHeight: 0,
    overflow: 'visible',
  },
  gridScroll: {
    flex: 1,
  },
  studentGridContent: {
    paddingBottom: 8,
    paddingTop: 2,
  },
  studentGridRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  studentTile: {
    width: '31%',
    minHeight: 94,
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  studentTileDefault: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
  },
  studentTilePresent: {
    backgroundColor: '#E8F3E4',
    borderColor: '#CDE3C6',
  },
  studentTileAbsent: {
    backgroundColor: '#F9E4E4',
    borderColor: '#EBC0C0',
  },
  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  studentAvatarDefault: {
    backgroundColor: '#fff',
  },
  studentAvatarPresent: {
    backgroundColor: '#CFE7CA',
  },
  studentAvatarAbsent: {
    backgroundColor: '#F0BDBD',
  },
  studentName: {
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    color: '#222',
    fontWeight: '700',
  },
});

export const behaviorStyles = StyleSheet.create({
  page: {
    padding: 16,
    gap: 14,
    backgroundColor: '#fff',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#7E7363',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    color: '#171717',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666058',
    maxWidth: 300,
  },
  heroBadge: {
    minWidth: 72,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#232323',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  heroBadgeLabel: {
    color: '#D5D5D5',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#7C7364',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  classSectionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  classSectionField: {
    flex: 1,
    minWidth: 0,
  },
  classSectionBadgeWrap: {
    flexShrink: 0,
    paddingBottom: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#6F675B',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  attendanceDropdownContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#f6f6f7',
    height: hp('4%'),
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: '#111827',
    fontSize: 13,
    paddingVertical: 0,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2C',
  },
  primaryButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE8DA',
    borderWidth: 1,
    borderColor: '#E0D6C2',
  },
  secondaryButtonText: {
    color: '#3E392F',
    fontSize: 13,
    fontWeight: '800',
  },
  gridCard: {
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    height: 330,
    overflow: 'hidden',
  },
  gridScroll: {
    flex: 1,
  },
  studentGridContent: {
    paddingBottom: 8,
    paddingTop: 2,
  },
  studentGridRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  studentTile: {
    width: '31%',
    minHeight: 94,
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  studentTileDefault: {
    backgroundColor: '#FCFBF8',
    borderColor: '#EEE5D6',
  },
  studentTilePresent: {
    backgroundColor: '#E8F3E4',
    borderColor: '#CDE3C6',
  },
  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#F1ECE2',
  },
  studentAvatarPresent: {
    backgroundColor: '#CFE7CA',
  },
  studentPhoto: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  studentName: {
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    color: '#222',
    fontWeight: '700',
  },
});

export const timetableStyles = StyleSheet.create({
  page: {
    padding: 16,
    gap: 14,
    backgroundColor: '#F4F1EA',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#7E7363',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    color: '#171717',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666058',
    maxWidth: 300,
  },
  heroBadge: {
    minWidth: 72,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#232323',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  heroBadgeLabel: {
    color: '#D5D5D5',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#7C7364',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  dropdownShell: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  modeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE8DA',
    borderWidth: 1,
    borderColor: '#E0D6C2',
  },
  modeButtonActive: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2C2C2C',
  },
  modeButtonText: {
    color: '#3E392F',
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: '#FFF',
  },
  timetableCard: {
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    height: 260,
    overflow: 'hidden',
  },
});
