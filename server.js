
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');  
const sharp = require('sharp'); // Image compression library
const teachBehavRoutes = require('./routes/TeachBehav');
const moment = require('moment-timezone');



const homework = require('./routes/teach_hw');
const Attendence = require('./routes/TeachAttendence');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { Client } = require('ssh2');
const zlib = require('zlib'); 
// Initialize Express app
const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Middleware to parse JSON and enable CORS
// 2. UPDATED: Set the global limit here
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const TeacherAcademicRoutes = require('./routes/Teach_acodamicp');
const managEventCal = require ('./routes/managEventCal')
const ManagTimetable = require ('./routes/ManagTimetable')
const TeacherTimetable = require ('./routes/TeacherTimetable')
const ParentTimetable = require ('./routes/Parenttimetable')
const ParentHomework = require ('./routes/Parenthomework')
const TeacherTimetableRetrive =require('./routes/Teachertimetableretrieve')
const SellerRoutes=require('./routes/seller')
const main = require('./routes/main')
const Notifications = require('./routes/Notifications');
const LiveChatRouter = require('./routes/LiveChat');
const OverallTeacherNotificationsRouter =require('./routes/OverallTeacherNotifications')
const ExtraCurcularActivities=require('./routes/extracircular')
const notificationRouter = require('./routes/notification')
const Fees = require('./routes/Fee')
const Managfee = require('./routes/Managfee')
const Feeretrieve = require('./routes/Parentfee')
const overAllReportsRoutes =require('./routes/OverAllReports')
const overallParentNotificationsRoutes = require('./routes/OverallParentNotfications')
const ManagementAcademicPerformance=require('./routes/managementAttendaceAcodamic')
const parentBusRoutes = require('./routes/ParentBus')
const busInsertionRoutes =require('./routes/BusInsertion')
const busManagerRoutes = require('./routes/BusManagerDashboard')
const driverLoginRoutes=require('./routes/DriverLogin')
const driversharingLocationRoutes =require('./routes/DriversharingLocation')
const driverStudentRoutes = require('./routes/DriverStudent')
const LoginRoutes = require('./routes/Logins');
const leaveteacher =require('./routes/leave_teacher')
const leave = require('./routes/leave')
const AttendanceNotification = require('./routes/AttendanceNotification');
const HolidayNotification = require('./routes/HolidayAnnouncement');
// const parentNotification=require('./routes/parentNotification')
const ScannerRoutes=require('./routes/sacanner')
const attendancetracking=require('./routes/AttendanceTracking')
const bill=require('./routes/bill')
const TeacherAttendanceretreival=require('./routes/teacherAttendanceRetreival')
// const fetchTomorrowHoliday = require('./notify');
// const cron = require('node-cron');
// // Runs every day at 9:00 AM
// cron.schedule('0 9 * * *', () => {
//   console.log('🔔 Checking for tomorrow\'s holiday...');
//   fetchTomorrowHoliday();
// });


const Photos = require ('./routes/Managph')

const admin = require("firebase-admin");

const oopsRoutes = require('./routes/oops');

const bodyParser = require('body-parser');
const cron = require('node-cron');
const serviceAccount = require('./firebase-service.json'); // 👈 your Firebase Admin SDK file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


function getQualityDbConnection() {
  return mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000', // MySQL password
      database: 'Quality', // Centralized database
  });
}

function sanitizeDbName(schoolName) {
  if (!schoolName || typeof schoolName !== 'string') {
    throw new Error('Invalid or missing schoolName');
  }

  return schoolName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/(^_|_$)/g, '');
}
function getDynamicDbConnection(schoolName) {
  if (!schoolName) {
    throw new Error('schoolName not provided to DB connection');
  }

  console.log("Connecting to database:", schoolName);

  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolName,
  });
}





// Ensure CORS settings allow requests from your frontend
app.use(cors({
  origin: '*',  // You can replace '' with specific domain if you want to restrict access to a certain domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// Session setup (ensure the user is logged in)
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set secure: true if you're using HTTPS
}));


const http = require('http');





const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server);


app.use(bodyParser.json());

// const io = new Server(server);

io.on('connection', (socket) => {
    console.log('A user connected: ', socket.id);
  
    socket.emit('connected', { message: 'You are now connected!' });
  
    socket.on('sendMessage', (data) => {
      const { sender, text, contact } = data;
  
      const query = "INSERT INTO messages (sender, text, contact) VALUES (?, ?, ?)";
      db.query(query, [sender, text, contact], (err, result) => {
        if (err) throw err;
        io.emit('receiveMessage', { sender, text, contact });
      });
    });
  
    socket.on('disconnect', () => {
      console.log('User disconnected: ', socket.id);
    });
  });

let schoolCode; // Variable to store schoolCode

// Endpoint to receive schoolCode from frontend
app.post('/api/saveSchoolCode', (req, res) => {
  const { schoolCode: code } = req.body;
  schoolCode = code; // Store schoolCode
  console.log('Received schoolCode:', schoolCode);
  res.status(200).json({ message: 'School code received successfully' });
});

async function sendAbsentTeacherNotifications() {
  if (!schoolCode) {
    console.error('Error: schoolCode is not defined');
    return;
  }

  console.log('Starting notification process with schoolCode:', schoolCode);
  
  const today = new Date().toISOString().split('T')[0];
  const db = getDynamicDbConnection(schoolCode);
  
  console.log('Today\'s date:', today);
  
  const attendanceQuery = `
    SELECT m.name
    FROM teachers_attendance t
    JOIN management_login_creation m ON t.username = m.username
    WHERE t.date = ? AND t.status = 'absent'
  `;
  
  const managementUsersQuery = `
    SELECT push_token
    FROM user_tokens
    WHERE user_type = 'management'
  `;
  
  try {
    console.log('Fetching absent teachers...');
    const [absentTeachers, managementUsers] = await Promise.all([
      new Promise((resolve, reject) => {
        db.query(attendanceQuery, [today], (err, results) => {
          if (err) {
            console.error('Error fetching absent teachers:', err);
            reject(err);
          } else {
            console.log('Absent teachers found:', results.length);
            resolve(results);
          }
        });
      }),
      new Promise((resolve, reject) => {
        db.query(managementUsersQuery, (err, results) => {
          if (err) {
            console.error('Error fetching management users:', err);
            reject(err);
          } else {
            console.log('Management users with tokens found:', results.length);
            resolve(results);
          }
        });
      }),
    ]);
    
    db.end(); // Close the connection

    if (absentTeachers.length === 0) {
      console.log('No absent teachers today - no notifications to send');
      return;
    }

    if (managementUsers.length === 0) {
      console.log('No management users with push tokens found');
      return;
    }

    const teacherNames = absentTeachers.map(t => t.name).join(', ');
    console.log('Preparing to send notifications about:', teacherNames);
    
    const messages = managementUsers.map(user => ({
      token: user.push_token,
      notification: {
        title: 'Teacher Absence Notification',
        body: `The following teachers are absent today: ${teacherNames}`,
      },
    }));

    console.log('Sending', messages.length, 'notifications...');
    
    try {
      const response = await admin.messaging().sendEach(messages);
      console.log('Successfully sent notifications:', response);
    } catch (error) {
      console.error('Error sending notifications:', error);
      if (error.errorInfo) {
        console.error('Firebase error details:', error.errorInfo);
      }
    }
  } catch (error) {
    console.error('Error in notification process:', error);
  }
}
// Add this at the start of your cron job function
console.log('Cron job triggered at:', new Date().toString());
// Runs at 1:30 PM every day
cron.schedule('7 18 * * *', () => {
  console.log('Running scheduled task to send notifications at 1:30 PM');
  sendAbsentTeacherNotifications();
});

// Set up Multer for handling file uploads (store files in memory for now)
const upload = multer({ storage: multer.memoryStorage() });
// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
// Compress image buffer using Sharp
const compressImageBuffer = async (imageBuffer) => {
    try {
        // Check if the image buffer is empty
        if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error('Empty image buffer');
        }

        console.log('Original image size (bytes):', imageBuffer.length);

        // Resize and compress the image using sharp
        const compressedBuffer = await sharp(imageBuffer)
            .resize({ width: 600, height: 400, fit: sharp.fit.contain }) // Resize to a smaller size (600x400)
            .jpeg({ quality: 50, progressive: true })  // Reduce quality to 50% and enable progressive rendering
            .toBuffer();

        console.log('Compressed image size (bytes):', compressedBuffer.length);
        return compressedBuffer;
    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error('Image compression failed: ' + error.message);
    }
};
// Compress image and save to disk
const processAndSaveImage = async (imageBuffer, username) => {
    try {
        if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error('Empty image buffer');
        }

        console.log('Original image size (bytes):', imageBuffer.length);

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `student_${username}_${timestamp}.jpg`;
        const filePath = path.join(uploadDir, filename);

        // Process and save the image
        await sharp(imageBuffer)
            .resize({ width: 600, height: 400, fit: sharp.fit.contain })
            .jpeg({ quality: 50, progressive: true })
            .toFile(filePath);

        console.log('Image processed and saved at:', filePath);
        return filename; // Return just the filename (relative path)
    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error('Image processing failed: ' + error.message);
    }
};

app.post('/submit-teacher-info', upload.single('photo'), async (req, res) => {
    const {
        schoolCode,
        username,
        teacher_name,
        password,
        father_name,
        gender,
        phone_no,
        designation,
        aadhar_no,
        address,
        teaches_to_1,
        teaches_to_2,
        teaches_to_3,
        teaches_to_4,
        teaches_to_5,
        user_type
    } = req.body;

    const photo = req.file;

    // Validate required fields
    if (!schoolCode || !username || !teacher_name || !password || !father_name || !gender || 
        !phone_no || !designation || !aadhar_no || !address || !user_type) {
        return res.status(400).json({ 
            success: false, 
            message: 'All required fields must be filled.' 
        });
    }

    if (!photo) {
        return res.status(400).json({ 
            success: false, 
            message: 'No photo provided.' 
        });
    }

    try {
        // Process and save the image
        const filename = await processAndSaveImage(photo.buffer, username);
        const relativePath = `uploads/${filename}`;

        // Prepare teaches_to values
        const teachesToValues = [
            teaches_to_1 && !isNaN(teaches_to_1) ? parseInt(teaches_to_1, 10) : 0,
            teaches_to_2 && !isNaN(teaches_to_2) ? parseInt(teaches_to_2, 10) : 0,
            teaches_to_3 && !isNaN(teaches_to_3) ? parseInt(teaches_to_3, 10) : 0,
            teaches_to_4 && !isNaN(teaches_to_4) ? parseInt(teaches_to_4, 10) : 0,
            teaches_to_5 && !isNaN(teaches_to_5) ? parseInt(teaches_to_5, 10) : 0,
        ];

        // Insert into the Quality database
        const qualityDb = getQualityDbConnection();
        const qualityInsertSql = `
            INSERT INTO management_login_creation (schoolCode, username, password, user_type)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            password = VALUES(password), 
            user_type = VALUES(user_type)
        `;

        await new Promise((resolve, reject) => {
            qualityDb.query(qualityInsertSql, 
                [schoolCode, username, password, user_type], 
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        // Insert into school-specific database
        const schoolDb = getDynamicDbConnection(schoolCode);
        const schoolInsertSql = `
            INSERT INTO management_login_creation 
            (schoolCode, username, password, name, father_name, gender, phone_no, 
             designation, aadhar_no, address, teaches_to_1, teaches_to_2, teaches_to_3, 
             teaches_to_4, teaches_to_5, user_type, photo, record_complete)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
        `;

        const schoolValues = [
            schoolCode,
            username,
            password,
            teacher_name,
            father_name,
            gender,
            phone_no,
            designation,
            aadhar_no,
            address,
            ...teachesToValues,
            user_type,
            relativePath
        ];

        schoolDb.query(schoolInsertSql, schoolValues, (err, result) => {
            if (err) {
                // Clean up the uploaded file if DB insertion fails
                fs.unlinkSync(path.join(uploadDir, filename));
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database error: ' + err.message 
                });
            }

            res.json({ 
                success: true, 
                message: 'Teacher profile saved successfully',
                data: {
                    teacherId: result.insertId,
                    photoUrl: `http://${req.headers.host}/${relativePath}`
                }
            });
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});
// app.post('/submit-student-info', upload.single('photo'), async (req, res) => {
//     const {
//         schoolCode,
//         username,
//         password,
//         name,
//         gender,
//         phone_no,
//         aadhar_no,
//         father_name,
//         class_name,
//         section,
//         class_teacher,
//         address,
//         user_type,
//         bus_number
//     } = req.body;

//     const photo = req.file;
//     console.log('Form Data:', req.body);
//     console.log('Uploaded Photo:', photo);

//     if (
//         !schoolCode || !username || !password || !name || !user_type ||
//         !gender || !phone_no || !aadhar_no || !father_name ||
//         !class_name || !section || !class_teacher || !address
//     ) {
//         return res.status(400).json({ success: false, message: 'All fields, including user_type, are required.' });
//     }

//     const qualityDb = getQualityDbConnection();
//     const dynamicDb = getDynamicDbConnection(schoolCode);

//     try {
//         let photoFilename = null;
//         if (photo) {
//             photoFilename = await processAndSaveImage(photo.buffer, username);
//             if (!photoFilename) {
//                 return res.status(500).json({ success: false, message: 'Failed to process image.' });
//             }
//         }

//         // Insert into QUALITY database
//         const checkSql = `
//             SELECT * FROM management_login_creation
//             WHERE username = ? AND user_type = ?
//         `;
//         const checkValues = [username, user_type];

//         qualityDb.query(checkSql, checkValues, (checkErr, checkResult) => {
//             if (checkErr) {
//                 console.error('Error checking user in quality DB:', checkErr);
//                 return res.status(500).json({ success: false, message: 'Error checking user in quality DB.' });
//             }

//             const qualitySql = checkResult.length === 0
//                 ? `INSERT INTO management_login_creation (username, password, user_type, schoolCode) VALUES (?, ?, ?, ?)`
//                 : `UPDATE management_login_creation SET password = ?, user_type = ?, schoolCode = ? WHERE username = ?`;

//             const qualityValues = checkResult.length === 0
//                 ? [username, password, user_type, schoolCode]
//                 : [password, user_type, schoolCode, username];

//             qualityDb.query(qualitySql, qualityValues, (qErr) => {
//                 if (qErr) {
//                     console.error('Error inserting into quality DB:', qErr);
//                     // Clean up uploaded file if error occurs
//                     if (photoFilename) {
//                         fs.unlink(path.join(uploadDir, photoFilename), (err) => {
//                             if (err) console.error('Error deleting uploaded file:', err);
//                         });
//                     }
//                     return res.status(500).json({ success: false, message: 'Error storing data in quality DB.' });
//                 }

//                 // Insert into DYNAMIC database
//                 const dynamicCheckSql = `SELECT * FROM management_login_creation WHERE username = ?`;
//                 dynamicDb.query(dynamicCheckSql, [username], (dynCheckErr, dynCheckResult) => {
//                     if (dynCheckErr) {
//                         console.error('Error checking dynamic DB:', dynCheckErr);
//                         // Clean up uploaded file if error occurs
//                         if (photoFilename) {
//                             fs.unlink(path.join(uploadDir, photoFilename), (err) => {
//                                 if (err) console.error('Error deleting uploaded file:', err);
//                             });
//                         }
//                         return res.status(500).json({ success: false, message: 'Error checking dynamic DB.' });
//                     }

//                     // Changed 'photo' column to 'photo' for storing filename
//                     const dynamicSql = dynCheckResult.length === 0
//                         ? `
//                             INSERT INTO management_login_creation
//                             (username, password, schoolCode, name, gender, phone_no, aadhar_no, father_name, 
//                             class_name, section, class_teacher, address, bus_number, photo)
//                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//                         `
//                         : `
//                             UPDATE management_login_creation
//                             SET password = ?, schoolCode = ?, name = ?, gender = ?, phone_no = ?, aadhar_no = ?, 
//                             father_name = ?, class_name = ?, section = ?, class_teacher = ?, address = ?, 
//                             bus_number = ?, photo = ?
//                             WHERE username = ?
//                         `;

//                     const dynamicValues = dynCheckResult.length === 0
//                         ? [username, password, schoolCode, name, gender, phone_no, aadhar_no, father_name, 
//                            class_name, section, class_teacher, address, bus_number, photoFilename]
//                         : [password, schoolCode, name, gender, phone_no, aadhar_no, father_name, 
//                            class_name, section, class_teacher, address, bus_number, photoFilename, username];

//                     dynamicDb.query(dynamicSql, dynamicValues, (dynErr) => {
//                         if (dynErr) {
//                             console.error('Error inserting into dynamic DB:', dynErr);
//                             // Clean up uploaded file if error occurs
//                             if (photoFilename) {
//                                 fs.unlink(path.join(uploadDir, photoFilename), (err) => {
//                                     if (err) console.error('Error deleting uploaded file:', err);
//                                 });
//                             }
//                             return res.status(500).json({ success: false, message: 'Error storing student info in dynamic DB.' });
//                         }

//                         res.json({ 
//                             success: true, 
//                             message: 'Student information saved successfully!',
//                             photoPath: photoFilename ? `/uploads/${photoFilename}` : null
//                         });
//                     });
//                 });
//             });
//         });

//     } catch (error) {
//         console.error('Error during file processing or database operations:', error);
//         res.status(500).json({ success: false, message: 'Failed to save data.' });
//     }
// });
app.post('/submit-student-info', upload.single('photo'), async (req, res) => {
  console.log('Received student info submission:', req.body);
  
  const {
    schoolCode,
    username,
    password,
    name,
    gender,
    phone_no,
    aadhar_no,
    father_name,
    class_name,
    section,
    class_teacher,
    address,
    user_type,
    bus_number,
    is_sibling
  } = req.body;

  const photo = req.file;

  // Log received data for debugging
  console.log('Received data:', {
    schoolCode, username, name, gender, phone_no, aadhar_no,
    father_name, class_name, section, class_teacher, address,
    user_type, bus_number, is_sibling, hasPhoto: !!photo
  });

  // Validate required fields
  if (!schoolCode || !username || !password || !name || !user_type ||
      !gender || !phone_no || !aadhar_no || !father_name ||
      !class_name || !section || !class_teacher || !address) {
    console.log('Missing required fields');
    return res.status(400).json({ 
      success: false, 
      message: 'All fields are required.' 
    });
  }

  try {
    const dynamicDb = getDynamicDbConnection(schoolCode);
    
    // Test database connection
    await dynamicDb.promise().query('SELECT 1');
    console.log('Database connection successful');

    // Check if Aadhar number already exists
    const checkAadharSql = `SELECT id FROM management_login_creation WHERE aadhar_no = ? AND schoolCode = ?`;
    const [existingAadhar] = await dynamicDb.promise().query(checkAadharSql, [aadhar_no, schoolCode]);
    
    if (existingAadhar.length > 0) {
      console.log('Aadhar number already exists:', aadhar_no);
      return res.status(400).json({ 
        success: false, 
        message: 'Aadhar number already exists in the system.' 
      });
    }

    // For siblings, verify credentials exist
    if (is_sibling === 'true') {
      console.log('Checking sibling credentials for:', username);
      const checkSiblingSql = `SELECT id, name FROM management_login_creation WHERE username = ? AND schoolCode = ?`;
      const [existingSibling] = await dynamicDb.promise().query(checkSiblingSql, [username, schoolCode]);
      
      if (existingSibling.length === 0) {
        console.log('Sibling credentials not found:', username);
        return res.status(400).json({ 
          success: false, 
          message: 'Sibling credentials not found. Please check username.' 
        });
      }
      
      // Optional: Verify password matches (if you store plain text passwords)
      const checkSiblingWithPasswordSql = `SELECT id FROM management_login_creation WHERE username = ? AND password = ? AND schoolCode = ?`;
      const [existingSiblingWithPassword] = await dynamicDb.promise().query(checkSiblingWithPasswordSql, [username, password, schoolCode]);
      
      if (existingSiblingWithPassword.length === 0) {
        console.log('Sibling password does not match');
        return res.status(400).json({ 
          success: false, 
          message: 'Sibling password is incorrect.' 
        });
      }
      
      console.log('Sibling credentials verified for:', existingSibling[0].name);
    }

    let photoFilename = null;
    if (photo) {
      console.log('Processing photo...');
      try {
        photoFilename = await processAndSaveImage(photo.buffer, username);
        if (!photoFilename) {
          console.log('Failed to process image');
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to process image.' 
          });
        }
        console.log('Photo processed successfully:', photoFilename);
      } catch (imageError) {
        console.error('Error processing image:', imageError);
        return res.status(500).json({ 
          success: false, 
          message: 'Error processing image.' 
        });
      }
    }

    // Insert student data
    const dynamicSql = `
      INSERT INTO management_login_creation
      (username, password, schoolCode, name, gender, phone_no, aadhar_no, father_name,
      class_name, section, class_teacher, address, bus_number, user_type, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const dynamicValues = [
      username, password, schoolCode, name, gender, phone_no, aadhar_no, father_name,
      class_name, section, class_teacher, address, bus_number || null, user_type, photoFilename
    ];

    console.log('Executing SQL with values:', dynamicValues);
    const [result] = await dynamicDb.promise().query(dynamicSql, dynamicValues);
    console.log('Database insert successful, ID:', result.insertId);

    res.json({
      success: true,
      message: 'Student information saved successfully!',
      studentId: result.insertId,
      photoPath: photoFilename ? `/uploads/${photoFilename}` : null,
      isSibling: is_sibling === 'true',
      credentials: {
        username: username,
        password: password
      }
    });

  } catch (error) {
    console.error('Error during database operations:', error);
    console.error('Error stack:', error.stack);
    
    // More specific error messages
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or Aadhar number already exists.' 
      });
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ 
        success: false, 
        message: 'Database table not found. Please check school configuration.' 
      });
    } else if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({ 
        success: false, 
        message: 'Database connection failed.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save student information.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/submit-complete-info', async (req, res) => {
  const { schoolCode,userType, username, password } = req.body;

  if (!schoolCode||!userType || !username || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  const db = getQualityDbConnection();

  try {
      // Hash the password before storing it
      const hashedPassword = await bcrypt.hash(password, 10);

      const insertSql = `
          INSERT INTO management_login_creation 
          (schoolCode,user_type, username, password, date, record_complete) 
          VALUES (?,?, ?, ?, ?, "false")
      `;
      db.query(insertSql, [schoolCode,userType, username, hashedPassword, new Date().toISOString().slice(0, 10)], (err, result) => {
          if (err) {
              console.error('Error storing user data:', err);
              return res.status(500).json({ success: false, message: 'Error creating account.' });
          }
          res.json({ success: true, message: 'Account created successfully!' });
      });
  } catch (err) {
      console.error('Error processing your request:', err);
      return res.status(500).json({ success: false, message: 'Error processing your request.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
        return res.status(400).json({ success: false, message: 'Username and new password are required.' });
    }

    try {
        // Directly update the password without hashing (not recommended for production)
        const updateSql = 'UPDATE management_login_creation SET password = ? WHERE username = ?';
        db.query(updateSql, [newPassword, username], (err, result) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).json({ success: false, message: 'An error occurred while updating the password.' });
            }

            if (result.affectedRows > 0) {
                console.log('Password updated successfully.');
                res.json({ success: true, message: 'Password updated successfully.' });
            } else {
                console.log('User not found or password update failed.');
                res.status(404).json({ success: false, message: 'User not found or password update failed.' });
            }
        });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again.' });
    }
});

//PASSWORD RESET FOR STUDENT//

app.post('/api/resett-password', async (req, res) => {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
        return res.status(400).json({ success: false, message: 'Username and new password are required.' });
    }

    try {
        // Directly update the password without hashing (not recommended for production)
        const updateSql = 'UPDATE management_login_creation SET password = ? WHERE username = ?';
        db.query(updateSql, [newPassword, username], (err, result) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).json({ success: false, message: 'An error occurred while updating the password.' });
            }

            if (result.affectedRows > 0) {
                console.log('Password updated successfully.');
                res.json({ success: true, message: 'Password updated successfully.' });
            } else {
                console.log('User not found or password update failed.');
                res.status(404).json({ success: false, message: 'User not found or password update failed.' });
            }
        });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again.' });
    }
});


// Endpoint to check if a username already exists (no longer necessary if we're not using usernames)
app.get('/check-username/:username', (req, res) => {
    return res.status(404).json({ success: false, message: 'This endpoint is not needed anymore.' });
});



// Handle student photo upload separately
app.post('/api/student/upload/photo', upload.single('photo'), async (req, res) => {
    const { username } = req.session;

    if (!username) {
        return res.status(401).json({ success: false, message: 'User not logged in. Please log in again.' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    try {
        const compressedPhoto = await compressImageBuffer(req.file.buffer);

        const query = `
            UPDATE management_login_creation 
            SET photo = ? 
            WHERE username = ? AND user_type = "student"
        `;
        db.query(query, [compressedPhoto, username], (err, result) => {
            if (err) {
                console.error('Error uploading photo:', err);
                return res.status(500).json({ success: false, message: 'Error uploading photo.' });
            }

            res.json({ success: true, message: 'Photo uploaded and compressed successfully.' });
        });
    } catch (error) {
        console.error('Error compressing image:', error);
        res.status(500).json({ success: false, message: 'Error compressing image.' });
    }
});// Retrieve student profile (including photo and name)
// app.get('/api/student/profile', (req, res) => {
//   const { username, schoolCode } = req.query;

//   console.log('[DEBUG] Profile request received:', { 
//     username: username ? `${username.substring(0, 3)}...` : 'undefined',
//     originalSchoolCode: schoolCode,
//     timestamp: new Date().toISOString() 
//   });

//   if (!username || !schoolCode) {
//     console.error('[ERROR] Missing parameters:', { username, schoolCode });
//     return res.status(400).json({ 
//       success: false, 
//       message: 'Both username and schoolCode are required.' 
//     });
//   }

//   try {
//     // Use original schoolCode exactly as received
//     console.log('[DEBUG] Attempting to connect to database for school:', schoolCode);
//     const db = getDynamicDbConnection(schoolCode);  // Using original case
    
//     if (!db) {
//       console.error('[ERROR] Failed to connect to database for school:', schoolCode);
//       return res.status(500).json({ 
//         success: false, 
//         message: 'Database connection failed.',
//         debug: {
//           attemptedDatabase: schoolCode,
//           note: 'Using exact case as provided'
//         }
//       });
//     }

//     console.log('[SUCCESS] Database connection established for:', schoolCode);

//     const query = `
//       SELECT * FROM management_login_creation
//       WHERE username = ? 
//       AND (user_type = 'student' OR user_type IS NULL)
//       LIMIT 1
//     `;

//     console.log('[DEBUG] Executing query:', {
//       query: query.replace(/\s+/g, ' ').trim(),
//       parameters: [username.trim()],
//       schoolCode: schoolCode
//     });

//     db.query(query, [username.trim()], (err, results) => {
//       if (err) {
//         console.error('[ERROR] Database query failed:', {
//           error: err.message,
//           code: err.code,
//           sqlState: err.sqlState,
//           schoolCode: schoolCode,
//           possibleSolutions: [
//             'Verify database name case matches exactly',
//             'Check database exists on server',
//             'Confirm user has access privileges'
//           ]
//         });
//         return res.status(500).json({ 
//           success: false, 
//           message: 'Database error occurred.',
//           debug: {
//             schoolCode: schoolCode,
//             errorDetails: {
//               code: err.code,
//               sqlMessage: err.sqlMessage
//             }
//           }
//         });
//       }

//       console.log('[DEBUG] Query results:', {
//         resultCount: results.length,
//         schoolCode: schoolCode
//       });
      
//       if (results.length === 0) {
//         console.warn('[WARN] No profile found for:', { 
//           username,
//           schoolCode,
//           possibleReasons: [
//             'User not in this school database',
//             'Username case mismatch',
//             'Different database name format expected'
//           ]
//         });
//         return res.status(404).json({ 
//           success: false, 
//           message: 'Profile not found.',
//           debug: {
//             schoolCode,
//             username,
//             note: 'Using exact database name case'
//           }
//         });
//       }

//       const student = results[0];
//       console.log('[DEBUG] Student record found:', {
//         id: student.id,
//         name: student.name,
//         username: student.username,
//         user_type: student.user_type,
//         schoolCodeInRecord: student.schoolCode, // Compare with requested
//         hasPhoto: !!student.photo
//       });

//    let photoUrl = null;
// if (student.photo) {
//   try {
//     // Case 1: If photo is a hex string (0x...)
//     if (typeof student.photo === 'string' && student.photo.startsWith('0x')) {
//       // Convert hex to ASCII (filename)
//       const hex = student.photo.substring(2); // Remove '0x'
//       let filename = '';
//       for (let i = 0; i < hex.length; i += 2) {
//         filename += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
//       }
//       photoUrl = `http://162.215.210.38:3010/uploads/${filename}`;
//     }
//     // Case 2: If photo is a Buffer (binary data)
//     else if (Buffer.isBuffer(student.photo)) {
//       photoUrl = `data:image/jpeg;base64,${student.photo.toString('base64')}`;
//     }
//     // Case 3: If photo is already a path (uploads/...)
//     else if (typeof student.photo === 'string' && student.photo.startsWith('uploads/')) {
//       photoUrl = `http://162.215.210.38:3010/${student.photo}`;
//     }
//   } catch (e) {
//     console.error('[ERROR] Photo processing failed:', e.message);
//   }
// }

//       const responseData = {
//         success: true,
//         student: {
//           name: student.name,
//           photoUrl,
//           gender: student.gender,
//           phone_no: student.phone_no,
//           aadhar_no: student.aadhar_no,
//           father_name: student.father_name,
//           class_name: student.class_name,
//           section: student.section,
//           class_teacher: student.class_teacher,
//           school_name: student.school_name || student.schoolCode,
//           address: student.address,
//           bus_number: student.bus_number
//         },
//         debug: {
//           schoolCodeUsed: schoolCode,
//           dbQuery: 'success',
//           note: 'Original schoolCode case was used'
//         }
//       };

//       res.json(responseData);
//     });
//   } catch (error) {
//     console.error('[ERROR] Server error:', {
//       message: error.message,
//       schoolCode,
//       timestamp: new Date().toISOString()
//     });
//     res.status(500).json({ 
//       success: false, 
//       message: 'Internal server error',
//       debug: {
//         schoolCode,
//         error: error.message
//       }
//     });
//   }
// });
app.get('/api/student/profile', (req, res) => {
  const { username, schoolCode } = req.query;

  console.log('[DEBUG] Profile request received:', { 
    username: username ? `${username.substring(0, 3)}...` : 'undefined',
    originalSchoolCode: schoolCode,
    timestamp: new Date().toISOString() 
  });

  if (!username || !schoolCode) {
    console.error('[ERROR] Missing parameters:', { username, schoolCode });
    return res.status(400).json({ 
      success: false, 
      message: 'Both username and schoolCode are required.' 
    });
  }

  try {
    // Use original schoolCode exactly as received
    console.log('[DEBUG] Attempting to connect to database for school:', schoolCode);
    const db = getDynamicDbConnection(schoolCode);  // Using original case
    
    if (!db) {
      console.error('[ERROR] Failed to connect to database for school:', schoolCode);
      return res.status(500).json({ 
        success: false, 
        message: 'Database connection failed.',
        debug: {
          attemptedDatabase: schoolCode,
          note: 'Using exact case as provided'
        }
      });
    }

    console.log('[SUCCESS] Database connection established for:', schoolCode);

    const query = `
      SELECT * FROM management_login_creation
      WHERE username = ? 
      AND (user_type = 'student' OR user_type IS NULL)
      LIMIT 1
    `;

    console.log('[DEBUG] Executing query:', {
      query: query.replace(/\s+/g, ' ').trim(),
      parameters: [username.trim()],
      schoolCode: schoolCode
    });

    db.query(query, [username.trim()], (err, results) => {
      if (err) {
        console.error('[ERROR] Database query failed:', {
          error: err.message,
          code: err.code,
          sqlState: err.sqlState,
          schoolCode: schoolCode,
          possibleSolutions: [
            'Verify database name case matches exactly',
            'Check database exists on server',
            'Confirm user has access privileges'
          ]
        });
        return res.status(500).json({ 
          success: false, 
          message: 'Database error occurred.',
          debug: {
            schoolCode: schoolCode,
            errorDetails: {
              code: err.code,
              sqlMessage: err.sqlMessage
            }
          }
        });
      }

      console.log('[DEBUG] Query results:', {
        resultCount: results.length,
        schoolCode: schoolCode
      });
      
      if (results.length === 0) {
        console.warn('[WARN] No profile found for:', { 
          username,
          schoolCode,
          possibleReasons: [
            'User not in this school database',
            'Username case mismatch',
            'Different database name format expected'
          ]
        });
        return res.status(404).json({ 
          success: false, 
          message: 'Profile not found.',
          debug: {
            schoolCode,
            username,
            note: 'Using exact database name case'
          }
        });
      }

      const student = results[0];
      console.log('[DEBUG] Student record found:', {
        id: student.id,
        name: student.name,
        username: student.username,
        user_type: student.user_type,
        schoolCodeInRecord: student.schoolCode, // Compare with requested
        hasPhoto: !!student.photo
      });

      let photoUrl = null;
      if (student.photo) {
        try {
          // Case 1: If photo is a hex string (0x...)
          if (typeof student.photo === 'string' && student.photo.startsWith('0x')) {
            // Convert hex to ASCII (filename)
            const hex = student.photo.substring(2); // Remove '0x'
            let filename = '';
            for (let i = 0; i < hex.length; i += 2) {
              filename += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
            }
            photoUrl = `http://162.215.210.38:3010/uploads/${filename}`;
          }
          // Case 2: If photo is a Buffer (binary data)
          else if (Buffer.isBuffer(student.photo)) {
            photoUrl = `data:image/jpeg;base64,${student.photo.toString('base64')}`;
          }
          // Case 3: If photo is already a path (uploads/...)
          else if (typeof student.photo === 'string' && student.photo.startsWith('uploads/')) {
            photoUrl = `http://162.215.210.38:3010/${student.photo}`;
          }
        } catch (e) {
          console.error('[ERROR] Photo processing failed:', e.message);
        }
      }

      const responseData = {
        success: true,
        student: {
          id: student.id,
          username: student.username,
          name: student.name,
          photoUrl,
          photo: photoUrl,
          gender: student.gender,
          phone_no: student.phone_no,
          aadhar_no: student.aadhar_no,
          father_name: student.father_name,
          class_name: student.class_name,
          section: student.section,
          class_teacher: student.class_teacher,
          school_name: student.school_name || student.schoolCode,
          address: student.address,
          bus_number: student.bus_number,
          schoolCode: student.schoolCode
        },
        debug: {
          schoolCodeUsed: schoolCode,
          dbQuery: 'success',
          note: 'Original schoolCode case was used'
        }
      };

      res.json(responseData);
    });
  } catch (error) {
    console.error('[ERROR] Server error:', {
      message: error.message,
      schoolCode,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      debug: {
        schoolCode,
        error: error.message
      }
    });
  }
});

// Updated sibling search endpoint - find by username only
app.post('/api/student/siblings', (req, res) => {
  const { username, schoolCode } = req.body;

  console.log('[DEBUG] Siblings request received:', { 
    username: username ? `${username.substring(0, 3)}...` : 'undefined',
    schoolCode: schoolCode,
    timestamp: new Date().toISOString() 
  });

  if (!username || !schoolCode) {
    console.error('[ERROR] Missing parameters for siblings search:', { 
      username, schoolCode
    });
    return res.status(400).json({ 
      success: false, 
      message: 'Username and school code are required.' 
    });
  }

  try {
    console.log('[DEBUG] Attempting to connect to database for siblings search:', schoolCode);
    const db = getDynamicDbConnection(schoolCode);
    
    if (!db) {
      console.error('[ERROR] Failed to connect to database for school:', schoolCode);
      return res.status(500).json({ 
        success: false, 
        message: 'Database connection failed.' 
      });
    }

    console.log('[SUCCESS] Database connection established for siblings search:', schoolCode);

    // Find ALL students with the same username (siblings share username)
    const siblingsQuery = `
      SELECT 
        id, username, name, gender, phone_no, aadhar_no, 
        father_name, class_name, section, address, photo,
        schoolCode, class_teacher, bus_number
      FROM management_login_creation 
      WHERE username = ? 
      AND schoolCode = ?
      AND user_type = 'student'
      ORDER BY class_name, name
    `;

    console.log('[DEBUG] Executing siblings query:', {
      query: siblingsQuery.replace(/\s+/g, ' ').trim(),
      parameters: [username.trim(), schoolCode],
      schoolCode: schoolCode
    });

    db.query(siblingsQuery, [username.trim(), schoolCode], (err, results) => {
      if (err) {
        console.error('[ERROR] Siblings database query failed:', {
          error: err.message,
          code: err.code,
          sqlState: err.sqlState,
          schoolCode: schoolCode
        });
        return res.status(500).json({ 
          success: false, 
          message: 'Database error occurred while searching for siblings.' 
        });
      }

      console.log('[DEBUG] Siblings query results:', {
        resultCount: results.length,
        schoolCode: schoolCode,
        username: username
      });

      if (results.length === 0) {
        console.log('[INFO] No siblings found for username:', { username, schoolCode });
        return res.json({
          success: true,
          message: 'No siblings found with the same username.',
          siblings: []
        });
      }

      const buildPhotoUrl = (photoValue) => {
        if (!photoValue) return null;

        try {
          if (typeof photoValue === 'string') {
            const trimmed = photoValue.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
            if (trimmed.startsWith('data:image')) return trimmed;
            if (trimmed.startsWith('/uploads/')) return `http://162.215.210.38:3010${trimmed}`;
            if (trimmed.startsWith('uploads/')) return `http://162.215.210.38:3010/${trimmed}`;
            if (trimmed.startsWith('0x')) {
              const hex = trimmed.substring(2);
              let filename = '';
              for (let i = 0; i < hex.length; i += 2) {
                filename += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
              }
              return `http://162.215.210.38:3010/uploads/${filename}`;
            }
            if (trimmed.includes('.') && !trimmed.includes(' ')) {
              return `http://162.215.210.38:3010/uploads/${trimmed}`;
            }
          }

          if (Buffer.isBuffer(photoValue)) {
            return `data:image/jpeg;base64,${photoValue.toString('base64')}`;
          }
        } catch (e) {
          console.error('[ERROR] Photo URL build failed:', e.message);
        }

        return null;
      };

      // Process photo URLs for siblings
      const processedSiblings = results.map(sibling => {
        const photoUrl = buildPhotoUrl(sibling.photo);

        return {
          id: sibling.id,
          username: sibling.username,
          name: sibling.name,
          gender: sibling.gender,
          phone_no: sibling.phone_no,
          aadhar_no: sibling.aadhar_no,
          father_name: sibling.father_name,
          class_name: sibling.class_name,
          section: sibling.section,
          address: sibling.address,
          class_teacher: sibling.class_teacher,
          bus_number: sibling.bus_number,
          schoolCode: sibling.schoolCode,
          photoUrl,
          photo: photoUrl
        };
      });

      console.log('[SUCCESS] Found siblings:', {
        count: processedSiblings.length,
        siblings: processedSiblings.map(s => ({
          id: s.id,
          name: s.name,
          username: s.username,
          class: s.class_name,
          section: s.section,
          father_name: s.father_name,
          phone_no: s.phone_no
        }))
      });

      res.json({
        success: true,
        message: `Found ${processedSiblings.length} sibling(s)`,
        siblings: processedSiblings
      });
    });
  } catch (error) {
    console.error('[ERROR] Server error in siblings endpoint:', {
      message: error.message,
      schoolCode,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while searching for siblings.' 
    });
  }
});
// Optional: Add a health check endpoint for testing
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      profile: '/api/student/profile',
      siblings: '/api/student/siblings'
    }
  });
});
  app.get('/api/teacher/profile', (req, res) => {
    // Get schoolCode and username from query parameters
    const { username, schoolCode } = req.query;

    console.log('[DEBUG] Received username and schoolCode:', { username, schoolCode });

    if (!username || !schoolCode) {
        return res.status(400).json({ success: false, message: 'Username or schoolCode missing.' });
    }

    const db = getDynamicDbConnection(schoolCode); // Get dynamic DB connection based on schoolCode
  
    if (!db) {
      console.error('[ERROR] Database connection failed');
      return res.status(500).json({ success: false, message: 'Database connection failed.' });
    }
  
    // SQL query to fetch teacher profile
    const query = `
        SELECT 
            name, 
            father_name, 
            photo, 
            gender, 
            designation, 
            phone_no, 
            aadhar_no, 
            address, 
            teaches_to_1, 
            teaches_to_2, 
            teaches_to_3, 
            teaches_to_4, 
            teaches_to_5
        FROM management_login_creation 
        WHERE username = ? AND user_type = 'teacher'
    `;

    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Database error while fetching profile.' });
        }

        if (results.length === 0) {
            console.error('No teacher found for the username:', username);
            return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
        }

        const teacher = results[0];
        console.log('[DEBUG] Retrieved Teacher Data:', teacher); // Log the retrieved data

        // Convert photo to Base64 if it exists
        const photoUrl = teacher.photo
            ? `data:image/jpeg;base64,${teacher.photo.toString('base64')}`
            : null;

        res.json({
            success: true,
            teacher: {
                name: teacher.name,
                father_name: teacher.father_name || 'N/A', // Add a fallback value
                photoUrl,
                gender: teacher.gender,
                designation: teacher.designation,
                phone_no: teacher.phone_no,
                aadhar_no: teacher.aadhar_no,
                address: teacher.address,
                teaches_to_classes: [
                    teacher.teaches_to_1,
                    teacher.teaches_to_2,
                    teacher.teaches_to_3,
                    teacher.teaches_to_4,
                    teacher.teaches_to_5,
                ].filter(Boolean), // Remove null/undefined classes
            },
        });
    });
});

// Handle photo upload endpoint
app.post('/api/upload/photo', upload.single('photo'), async (req, res) => {
    const { username } = req.session;

    if (!username) {
        return res.status(401).json({ success: false, message: 'User not logged in. Please log in again.' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    try {
        const compressedPhoto = await compressImageBuffer(req.file.buffer); // Compress the image

        const query = 'UPDATE management_login_creation SET photo = ? WHERE username = ? AND user_type = "teacher"';
        db.query(query, [compressedPhoto, username], (err, result) => {
            if (err) {
                console.error('Error uploading photo:', err);
                return res.status(500).json({ success: false, message: 'Error uploading photo.' });
            }

            res.json({ success: true, message: 'Photo uploaded and compressed successfully.' });
        });
    } catch (error) {
        console.error('Error compressing image:', error);
        return res.status(500).json({ success: false, message: 'Error compressing image.' });
    }
});
// Use CORS to handle cross-origin requests
app.use(cors());

const API_KEY = '147d13c7ea16c5b3d8827693ffe47786'; // Your OpenWeatherMap API Key

app.get('/weather', async (req, res) => {
  const city = req.query.q || 'Hyderabad'; // Default to Hyderabad if no city is provided

  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: {
        q: city,
        appid: API_KEY,
        units: 'metric',
      },
    });

    // Send the weather data back as JSON
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching weather data:', error.message);

    // Respond with a meaningful error message
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});





app.post('/submit-management-info', upload.single('photo'), async (req, res) => {
    const {
        schoolCode,
        username,
        teacher_name,
        password,
        father_name,
        gender,
        phone_no,
        designation,
        aadhar_no,
        address,
        teaches_to_1,
        teaches_to_2,
        teaches_to_3,
        teaches_to_4,
        teaches_to_5,
        user_type
    } = req.body;

    const photo = req.file;

    console.log('Form Data:', req.body);
    console.log('Uploaded Photo:', req.file);

    if (!schoolCode || !username || !teacher_name || !password || !father_name || !gender || !phone_no || !designation || !aadhar_no || !address || !user_type) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }

    if (!photo) {
        return res.status(400).json({ success: false, message: 'No photo provided.' });
    }

    try {
        const compressedPhotoData = await compressImageBuffer(photo.buffer);
        if (!compressedPhotoData) {
            return res.status(500).json({ success: false, message: 'Failed to compress image.' });
        }

        const teachesToValues = [
            teaches_to_1 && !isNaN(teaches_to_1) ? parseInt(teaches_to_1, 10) : 0,
            teaches_to_2 && !isNaN(teaches_to_2) ? parseInt(teaches_to_2, 10) : 0,
            teaches_to_3 && !isNaN(teaches_to_3) ? parseInt(teaches_to_3, 10) : 0,
            teaches_to_4 && !isNaN(teaches_to_4) ? parseInt(teaches_to_4, 10) : 0,
            teaches_to_5 && !isNaN(teaches_to_5) ? parseInt(teaches_to_5, 10) : 0,
        ];

        const schoolDb = getDynamicDbConnection(schoolCode);
        const schoolInsertSql = `
            INSERT INTO management_login_creation 
            (schoolCode, username, password, name, father_name, gender, phone_no, designation, aadhar_no, address, 
            teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5, user_type, photo, record_complete)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
        `;

        const schoolValues = [
            schoolCode,
            username,
            password,
            teacher_name,
            father_name,
            gender,
            phone_no,
            designation,
            aadhar_no,
            address,
            ...teachesToValues,
            user_type,
            compressedPhotoData
        ];

        schoolDb.query(schoolInsertSql, schoolValues, (schoolErr) => {
            if (schoolErr) {
                console.error('Error inserting into school-specific DB:', schoolErr);
                schoolDb.end();
                return res.status(500).json({ success: false, message: 'Error storing teacher info in school database.' });
            }

            const qualityDb = getQualityDbConnection();
            const qualityInsertSql = `
                INSERT INTO management_login_creation (schoolCode, name, username, password, user_type)
                VALUES (?, ?, ?, ?, ?)
            `;

            const qualityValues = [schoolCode, teacher_name, username, password, user_type];  // ✅ Fixed array

            qualityDb.query(qualityInsertSql, qualityValues, (qualityErr) => {
                schoolDb.end();
                qualityDb.end();

                if (qualityErr) {
                    console.error('Error inserting into Quality DB:', qualityErr);
                    return res.status(500).json({ success: false, message: 'Error storing basic info in Quality database.' });
                }

                res.json({ success: true, message: 'Teacher information uploaded successfully to both databases!' });
            });
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload data.' });
    }
});




app.get('/api/management/profile', (req, res) => {
  // Get username and schoolCode from query parameters
  const { username, schoolCode } = req.query;

  // Debug log to see what is received in the query parameters
  console.log('[DEBUG] Received username and schoolCode:', { username, schoolCode });

  // Check if both username and schoolCode are provided
  if (!username || !schoolCode) {
      console.log('[DEBUG] Missing username or schoolCode');
      return res.status(400).json({ success: false, message: 'Username or schoolCode missing.' });
  }
    const db = getDynamicDbConnection(schoolCode); // Get dynamic DB connection based on schoolCode

  // SQL query to fetch management profile
  const query = `
      SELECT 
          name, 
          photo, 
          phone_no, 
          address 
      FROM management_login_creation 
      WHERE username = ? AND user_type = 'management'
  `;

  console.log('[DEBUG] Executing SQL query with username:', username);

  db.query(query, [username], (err, results) => {
      if (err) {
          console.error('[ERROR] Database query error:', err);
          return res.status(500).json({ success: false, message: 'Database error while fetching profile.' });
      }

      if (results.length === 0) {
          console.log('[DEBUG] No management profile found for username:', username);
          return res.status(404).json({ success: false, message: 'Management profile not found.' });
      }

      const management = results[0];
      console.log('[DEBUG] Retrieved Management Data:', management); // Log the retrieved data

      // Convert photo to Base64 if it exists
      const photoUrl = management.photo
          ? `data:image/jpeg;base64,${management.photo.toString('base64')}`
          : null;

      // Log the result before sending it as a response
      console.log('[DEBUG] Management profile response data:', {
          name: management.name,
          photoUrl,
          phone_no: management.phone_no,
          address: management.address,
      });

      res.json({
          success: true,
          management: {
              name: management.name,
              photoUrl,
              phone_no: management.phone_no,
              address: management.address,
          },
      });
  });
});



   

// API endpoint to update the class and section for a teacher
app.post('/update-class-section', (req, res) => {
    const { username, className, section } = req.body;

    if (!username || !className || !section) {
        return res.status(400).json({ error: 'Username, class, and section are required' });
    }

    console.log(`Received data: ${username}, ${className}, ${section}`);


    // Make sure we're updating the correct teacher's record.
    const query = `
        UPDATE attendance_frontend_search 
        SET class_name = ?, section = ?    
        WHERE teacher = ? AND teacher IS NOT NULL;
    `;

    db.query(query, [className, section, username], (error, results) => {
        if (error) {
            console.error('Error updating class and section:', error);
            return res.status(500).json({ error: 'Error updating class and section' });
        }

        console.log('Query results:', results); // Log results to check affected rows

        // If no rows are affected, it means the teacher wasn't found or the update didn't match.
        if (results.affectedRows === 0) {
            console.log(`No rows updated for teacher: ${username}`);
            return res.status(404).json({ error: 'Teacher not found or invalid update' });
        }

        // Send success response
        res.json({ message: 'Class and section updated successfully' });
    });
});












function convertTo24HourFormat(timeStr) {
    if (!timeStr) return null;

    const regex = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
    const match = timeStr.match(regex);

    if (!match) {
        console.log(`Invalid time format detected: ${timeStr}`);
        return null; // Invalid format
    }

    let [, hours, minutes, modifier] = match;
    hours = parseInt(hours);
    if (modifier === 'PM' && hours !== 12) {
        hours += 12; // Convert PM hours to 24-hour format
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0; // Convert 12 AM to 00 hours (midnight)
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}:00`; // Return as HH:MM:SS
}

// Function to validate time format (AM/PM format or 24-hour format)
function isValidTime(timeStr) {
    const ampmPattern = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const militaryPattern = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9]):([0-5]?[0-9])$/;

    return ampmPattern.test(timeStr) || militaryPattern.test(timeStr);
}


app.post('/submit-timetable', (req, res) => {
    const {
        class_id,
        section_id,
        day,
        morning_interval_time,
        lunch_interval_time,
        afternoon_interval_time,
        evening_interval_time,
        period_1_subject, period_1_from_time, period_1_to_time,
        period_2_subject, period_2_from_time, period_2_to_time,
        period_3_subject, period_3_from_time, period_3_to_time,
        period_4_subject, period_4_from_time, period_4_to_time,
        period_5_subject, period_5_from_time, period_5_to_time,
        period_6_subject, period_6_from_time, period_6_to_time,
        period_7_subject, period_7_from_time, period_7_to_time,
        period_8_subject, period_8_from_time, period_8_to_time,
        period_9_subject, period_9_from_time, period_9_to_time,
        period_10_subject, period_10_from_time, period_10_to_time
    } = req.body;

    // Validate required fields
    if (!day || !class_id || !section_id) {
        return res.status(400).json({ error: 'Day, Class ID, and Section ID are required' });
    }

    // Function to sanitize invalid or undefined time values to NULL
    function sanitizeTime(timeStr) {
        if (timeStr && isValidTime(timeStr)) {
            return convertTo24HourFormat(timeStr);
        } else if (timeStr) {
            console.log(`Invalid time format detected: ${timeStr}`);
        }
        return null;
    }

    // Sanitize all time fields
    const convertedTimetableData = [
        class_id, section_id, day,
        sanitizeTime(morning_interval_time),
        sanitizeTime(lunch_interval_time),
        sanitizeTime(afternoon_interval_time),
        sanitizeTime(evening_interval_time),

        period_1_subject || null, sanitizeTime(period_1_from_time) || null, sanitizeTime(period_1_to_time) || null,
        period_2_subject || null, sanitizeTime(period_2_from_time) || null, sanitizeTime(period_2_to_time) || null,
        period_3_subject || null, sanitizeTime(period_3_from_time) || null, sanitizeTime(period_3_to_time) || null,
        period_4_subject || null, sanitizeTime(period_4_from_time) || null, sanitizeTime(period_4_to_time) || null,
        period_5_subject || null, sanitizeTime(period_5_from_time) || null, sanitizeTime(period_5_to_time) || null,
        period_6_subject || null, sanitizeTime(period_6_from_time) || null, sanitizeTime(period_6_to_time) || null,
        period_7_subject || null, sanitizeTime(period_7_from_time) || null, sanitizeTime(period_7_to_time) || null,
        period_8_subject || null, sanitizeTime(period_8_from_time) || null, sanitizeTime(period_8_to_time) || null,
        period_9_subject || null, sanitizeTime(period_9_from_time) || null, sanitizeTime(period_9_to_time) || null,
        period_10_subject || null, sanitizeTime(period_10_from_time) || null, sanitizeTime(period_10_to_time) || null
    ];

    // Log sanitized data before SQL insertion (for debugging purposes)
    console.log('Sanitized Timetable Data:', convertedTimetableData);

    // SQL Query to insert timetable data (exclude the auto-generated columns: id, created_at, updated_at)
    const query = `
        INSERT INTO UniqueTimetable (
            class_id, section_id, day, morning_interval_time, lunch_interval_time, 
            afternoon_interval_time, evening_interval_time,
            period_1_subject, period_1_from_time, period_1_to_time,
            period_2_subject, period_2_from_time, period_2_to_time,
            period_3_subject, period_3_from_time, period_3_to_time,
            period_4_subject, period_4_from_time, period_4_to_time,
            period_5_subject, period_5_from_time, period_5_to_time,
            period_6_subject, period_6_from_time, period_6_to_time,
            period_7_subject, period_7_from_time, period_7_to_time,
            period_8_subject, period_8_from_time, period_8_to_time,
            period_9_subject, period_9_from_time, period_9_to_time,
            period_10_subject, period_10_from_time, period_10_to_time
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)
    `;

    // Execute the query
    db.query(query, convertedTimetableData, (err, results) => {
        if (err) {
            console.error("Error inserting timetable:", err);
            return res.status(500).send("Error inserting timetable");
        }
        console.log("Timetable inserted successfully!");
        return res.status(200).send("Timetable inserted successfully!");
    });
});

app.get('/attendance/:username', (req, res) => {
    const username = req.params.username;
  
    // SQL Query to fetch attendance data for the specific user with case-insensitive leave type check
    const query = `
      SELECT name, class, section, leavetype, DATE_FORMAT(date, '%Y-%m-%d') as date
      FROM attendance_frontend
      WHERE name = ?`;
  
    db.query(query, [username], (err, results) => {
      if (err) {
        console.error('Error fetching data:', err);
        return res.status(500).json({ message: 'Server error' });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ message: 'No data found for the user' });
      }
  
      // Initialize counts
      let present = 0;
      let informed = 0;
      let uninformed = 0;
  
      // Loop through results and count the leave types
      results.forEach((row) => {
        const leaveTypeLower = row.leavetype.toLowerCase(); // Convert the leavetype to lowercase
  
        if (leaveTypeLower === 'present') present++;
        if (leaveTypeLower === 'informed') informed++;
        if (leaveTypeLower === 'uninformed') uninformed++;
      });
  
      // Calculate percentages
      const totalAttendance = present + informed + uninformed;
      const presentPercentage = (present / totalAttendance) * 100;
      const informedPercentage = (informed / totalAttendance) * 100;
      const uninformedPercentage = (uninformed / totalAttendance) * 100;
  
      // Prepare the response data
      const attendanceData = {
        present,
        informed,
        uninformed,
        presentPercentage,
        informedPercentage,
        uninformedPercentage,
        informedDetails: results
          .filter(item => item.leavetype.toLowerCase() === 'informed')
          .map(item => ({
            date: item.date,
            class: item.class,
            section: item.section,
          })),
        uninformedDetails: results
          .filter(item => item.leavetype.toLowerCase() === 'uninformed')
          .map(item => ({
            date: item.date,
            class: item.class,
            section: item.section,
          })),
      };
  
      return res.json(attendanceData); // Send data to the frontend
    });
  });






  app.get('/student-performance', (req, res) => {
    const { name } = req.query;
  
    // Check if name is provided in the query
    if (!name) {
      return res.status(400).json({ error: 'Student name is required' });
    }
  
    // Query to get total marks for each subject based on the student name
    const query = `
      SELECT subject, SUM(marks) AS total_marks
      FROM academic_performance_of_student
      WHERE name = ?
      GROUP BY subject;
    `;
  
    // Execute query to fetch student data
    db.query(query, [name], (err, results) => {
      if (err) {
        console.error('Error fetching data from database:', err);
        return res.status(500).json({ error: 'Error fetching data from the database' });
      }
  
      // If no results found for the student
      if (results.length === 0) {
        return res.status(404).json({ error: 'No academic data found for this student' });
      }
  
      // Send the results (academic data) to the frontend
      res.json(results);
    });
  });


  app.get('/report/:username', (req, res) => {
    const { username } = req.params; // Get the username from the URL parameters
  
    // Validate if the username is provided
    if (!username) {
      return res.status(400).json({ error: 'Student name is required' });
    }
  
    // Query to get behavior report data and corresponding comments for the given student's name
    const query = `
      SELECT report, comment
      FROM teachers_student_report
      WHERE name = ?
    `;
  
    // Execute the query to fetch the report and comment data for the given student
    db.query(query, [username], (err, results) => {
      if (err) {
        console.error('Error fetching behavior report data from database:', err);
        return res.status(500).json({ error: 'Error fetching data from the database' });
      }
  
      // If no behavior reports found for the student
      if (results.length === 0) {
        return res.status(404).json({ error: 'No behavior reports found for this student' });
      }
  
      // Calculate the percentages of Positive, Needs Improvement, and Negative reports
      const totalReports = results.length;
      const positiveCount = results.filter((item) => item.report === 'Positive').length;
      const needsImprovementCount = results.filter((item) => item.report === 'Needs to Improvement').length;
      const negativeCount = results.filter((item) => item.report === 'Negative').length;
  
      // Categorize the results based on the report type and include comments
      const data = {
        Positive: results.filter((item) => item.report === 'Positive').map((item) => item.comment),
        NeedsToImprovement: results.filter((item) => item.report === 'Needs to Improvement').map((item) => item.comment),
        Negative: results.filter((item) => item.report === 'Negative').map((item) => item.comment),
      };
  
      // Send the calculated percentages along with the comments as a response
      const response = {
        positivePercentage: Math.round((positiveCount / totalReports) * 100),
        needsImprovementPercentage: Math.round((needsImprovementCount / totalReports) * 100),
        negativePercentage: Math.round((negativeCount / totalReports) * 100),
        comments: data // Include the categorized comments
      };
  
      // Send the response containing percentages and comments
      res.json(response);
    });
});
//PARENT HOMEWORK RETRIEVEL
app.get('/student', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'Username is required in the query parameter.' });
    }

    const query = `
        SELECT class_name, section
        FROM management_login_creation 
        WHERE username = ?`;

    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error fetching student profile:', err);
            return res.status(500).json({ message: 'Database error while fetching profile.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Student profile not found.' });
        }

        const { class_name, section } = results[0];
        res.json({ data: { class_name, section } });
    });
});

// Endpoint to fetch homework list for a class and section
app.get('/homework-list', (req, res) => {
    const { class_name, section } = req.query;

    if (!class_name || !section) {
        return res.status(400).json({ message: 'Class name and section are required.' });
    }

    const query = 'SELECT * FROM teachers_homework_upload WHERE class_name = ? AND section = ?';
    db.query(query, [class_name, section], (err, results) => {
        if (err) {
            console.error('Error fetching homework list:', err);
            return res.status(500).json({ message: 'Error fetching homework list.' });
        }

        const formattedResults = results.map((row) => {
            let homeworkFile = null;

            // Check if homework_file exists and if it's binary data
            if (row.homework_file) {
                // Convert binary data to base64
                homeworkFile = row.homework_file.toString('base64');
            }

            return {
                ...row,
                homework_file: homeworkFile,
            };
        });

        res.status(200).json(formattedResults);
    });
});

// Endpoint to download a specific homework file
app.get('/download-homework', (req, res) => {
    const { homeworkId } = req.query;

    if (!homeworkId) {
        return res.status(400).json({ message: 'Homework ID is required.' });
    }

    const query = 'SELECT homework_file, homework_filename FROM teachers_homework_upload WHERE homework_id = ?';
    db.query(query, [homeworkId], (err, results) => {
        if (err) {
            console.error('Error fetching homework file:', err);
            return res.status(500).json({ message: 'Error fetching homework file.' });
        }

        if (results.length === 0 || !results[0].homework_file) {
            return res.status(404).json({ message: 'Homework file not found.' });
        }

        const file = results[0].homework_file;
        const filename = results[0].homework_filename || 'homework';

        // Set appropriate headers for downloading a file
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(file);  // Sends the binary file directly to the client
    });

});

app.get('/studentname', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'Username is required in the query parameter.' });
    }

    const query = `
        SELECT name
        FROM management_login_creation 
        WHERE username = ?`;

    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error fetching student profile:', err);
            return res.status(500).json({ message: 'Database error while fetching profile.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Student profile not found.' });
        }

        const { name } = results[0];
        res.json({ data: { name } });
    });
});




// Endpoint to submit notification and send push notifications
app.post('/submit-notification', (req, res) => {
  const { title, notificationText, date, recipient, priority,schoolCode } = req.body;
 const db = getDynamicDbConnection(schoolCode);
  // Validate input
  if (!title || !notificationText || !date || !recipient || !priority) {
      return res.status(400).json({ message: 'Please fill in all fields.' });
  }

  try {
      // Convert date to MySQL DATE format
      const formattedDate = new Date(date).toISOString().split('T')[0]; // 'YYYY-MM-DD'

      // Save the notification in the database
      const insertQuery = `
      INSERT INTO management_notifications (title, notification_text, date, recipient, priority)
      VALUES (?, ?, ?, ?, ?)
    `;
      db.query(
          insertQuery,
          [title, notificationText, formattedDate, recipient, priority],
          (insertError, results) => {
              if (insertError) {
                  console.error('Error inserting notification into the database:', insertError);
                  return res
                      .status(500)
                      .json({ message: 'Error saving notification.', error: insertError.message });
              }

              console.log('Notification saved successfully:', results);

              // Fetch push tokens based on recipient type
              let selectQuery = '';
              if (recipient === 'student') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE user_type = 'student'";
              } else if (recipient === 'teacher') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE user_type = 'teacher'";
              } else if (recipient === 'both') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE user_type IN ('student', 'teacher')";
              } else if (recipient === '10') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '10'"; 
              } else if (recipient === '9') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '9'";
              } else if (recipient === '8') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '8'";
              } else if (recipient === '7') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '7'";
              } else if (recipient === '6') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '6'";
              } else if (recipient === '5') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '5'";
              } else if (recipient === '4') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '4'";
              } else if (recipient === '3') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '3'";
              } else if (recipient === '2') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '2'";
              } else if (recipient === '1') {
                  selectQuery = "SELECT push_token FROM user_tokens WHERE class_name = '1'";
              } else {
                  return res.status(400).json({ message: 'Invalid recipient type.' });
              }

              db.query(selectQuery, async (selectError, rows) => {
                  if (selectError) {
                      console.error('Error fetching push tokens:', selectError);
                      return res
                          .status(500)
                          .json({ message: 'Error fetching push tokens.', error: selectError.message });
                  }

                  const pushTokens = rows.map((row) => row.push_token);

                  if (pushTokens.length === 0) {
                      return res
                          .status(200)
                          .json({ message: 'Notification saved, but no users found for the recipient.' });
                  }

                  // Send notifications one by one using `admin.messaging().send()`
                  let successCount = 0;
                  let failureCount = 0;
                  const errors = [];

                  for (const token of pushTokens) {

                      const fcmPriority =
                          priority === 'High' ? 'HIGH' :
                              (priority === 'Medium' || priority === 'Low') ? 'NORMAL' : 'NORMAL';
                      try {
                          await admin.messaging().send({
                              token: token,
                              notification: {
                                  title: title,
                                  body: notificationText,
                              },
                              android: {
                                  priority: fcmPriority,
                              },
                          });
                          successCount++;
                      } catch (sendError) {
                          console.error('Error sending notification to token:', token, sendError.message);
                          failureCount++;
                          errors.push({ token, error: sendError.message });
                      }
                  }

                  console.log(
                      `Push notifications sent successfully: ${successCount}, Failures: ${failureCount}`
                  );

                  res.status(201).json({
                      message: 'Notification submitted and push notifications sent.',
                      successCount,
                      failureCount,
                      errors,
                  });
              });
          }
      );
  } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ message: 'An unexpected error occurred.', error: error.message });
  }
});






// Handle GET request to retrieve notification count
app.get('/get-notification-count', (req, res) => {
    const query = `
          SELECT COUNT(*) AS count
        FROM management_notifications
       WHERE recipient IN ('teacher', 'both')  -- Only count notifications for 'Students' or 'Both'
    `;


    // Replace 'recipientIdentifier' with the actual recipient (or remove it if not needed)
    db.query(query, ['recipientIdentifier'], (error, results) => { 
        if (error) {
            console.error('Error retrieving notification count:', error);
            return res.status(500).json({ message: 'Error retrieving notification count.', error: error.message });
        }

        console.log('Notification count retrieved successfully:', results[0].count);
        res.status(200).json({ count: results[0].count });
    });
});




// Endpoint to Save Push Token
const savePushToken = (req, res) => {
  const {
    username,
    schoolCode,
    userType,
    className,
  } = req.body;
  const pushToken = req.body.push_token || req.body.pushToken;
  const tokenPreview = pushToken
    ? `${String(pushToken).slice(0, 12)}...${String(pushToken).slice(-8)}`
    : null;

  console.log('[PushToken] Request received', {
    path: req.originalUrl,
    method: req.method,
    username,
    schoolCode,
    userType,
    className,
    hasPushToken: Boolean(pushToken),
    tokenLength: pushToken ? String(pushToken).length : 0,
    tokenPreview,
    bodyKeys: Object.keys(req.body || {}),
  });

  if (!schoolCode || !username || !pushToken) {
    console.warn('[PushToken] Missing required fields', {
      hasSchoolCode: Boolean(schoolCode),
      hasUsername: Boolean(username),
      hasPushToken: Boolean(pushToken),
    });
    return res.status(400).json({
      success: false,
      message: 'Missing required fields.',
      required: ['schoolCode', 'username', 'push_token'],
    });
  }

  let db;
  try {
    console.log('[PushToken] Connecting to school database', { schoolCode });
    db = getDynamicDbConnection(schoolCode);
  } catch (err) {
    console.error('[PushToken] DB connection error:', err.message);
    return res.status(500).json({ success: false, message: 'Database connection error.' });
  }

  console.log('[PushToken] Reading user_tokens columns');
  db.query('SHOW COLUMNS FROM user_tokens', (columnsErr, columns) => {
    if (columnsErr) {
      db.end();
      console.error('[PushToken] Error reading user_tokens columns:', columnsErr);
      return res.status(500).json({ success: false, message: 'Database error.' });
    }

    const columnNames = new Set(columns.map((column) => column.Field));
    console.log('[PushToken] user_tokens columns found', {
      columns: Array.from(columnNames),
    });

    const tokenData = {
      username,
      push_token: pushToken,
      user_type: userType,
      schoolCode,
      school_code: schoolCode,
      class_name: className,
    };
    const insertColumns = ['username', 'push_token', 'user_type', 'schoolCode', 'school_code', 'class_name']
      .filter((column) => columnNames.has(column) && tokenData[column] !== undefined);
    const placeholders = insertColumns.map(() => '?').join(', ');
    const updates = insertColumns
      .filter((column) => column !== 'username')
      .map((column) => `${column} = VALUES(${column})`)
      .join(', ');
    const values = insertColumns.map((column) => tokenData[column]);
    const query = `
      INSERT INTO user_tokens (${insertColumns.join(', ')})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updates || 'username = VALUES(username)'}
    `;

    console.log('[PushToken] Running insert/upsert', {
      username,
      schoolCode,
      insertColumns,
      valueCount: values.length,
    });

    db.query(query, values, (err) => {
      db.end();
      if (err) {
        console.error('[PushToken] Error saving push token:', {
          message: err.message,
          code: err.code,
          errno: err.errno,
          sqlState: err.sqlState,
          sqlMessage: err.sqlMessage,
        });
        return res.status(500).json({ success: false, message: 'Database error.' });
      }

      console.log('[PushToken] Saved successfully', {
        username,
        schoolCode,
        userType,
        className,
        tokenLength: String(pushToken).length,
      });

      res.json({ success: true, message: 'Push token saved successfully.' });
    });
  });
};

app.post('/save-token', savePushToken);
app.post('/api/store-push-tok', savePushToken);




app.post('/send-notification', async (req, res) => {
    const { message } = req.body;
  
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
  
    try {
      // Query to fetch all push tokens from the database
      db.query('SELECT push_token FROM user_tokens', async (err, results) => {
        if (err) {
          console.error('Error fetching tokens:', err);
          return res.status(500).json({ success: false, message: 'Failed to fetch push tokens.' });
        }
  
        // Check if any tokens were fetched
        const tokens = results.map(result => result.push_token);
  
        if (tokens.length === 0) {
          return res.status(404).json({ success: false, message: 'No users found.' });
        }
  
        // Log tokens for debugging purposes
        console.log('Tokens:', tokens);
  
        // Create the message payload
        const messagePayload = {
          notification: {
            title: 'Broadcast Notification',
            body: message,
          },
        };
  
        // Prepare an array of promises to send notifications to all users
        const sendPromises = tokens.map(token => {
          const payload = { ...messagePayload, token };
          return admin.messaging().send(payload); // Send notification for each token
        });
  
        // Wait for all notifications to be sent
        try {
          // Use Promise.all to send notifications to all tokens
          const responses = await Promise.all(sendPromises);
          
          // Log responses for debugging
          console.log('Notification responses:', responses);
  
          return res.status(200).json({ success: true, message: 'Notification sent to all users.' });
        } catch (error) {
          console.error('Error sending notification:', error);
          return res.status(500).json({ success: false, message: 'Failed to send notification.' });
        }
      });
    } catch (error) {
      console.error('Error in /send-notification:', error);
      return res.status(500).json({ success: false, message: 'Failed to send notification.' });
    }
  });



   
     
     

// Enhanced notification sender with detailed logging
app.post('/submit-attendance-notification', async (req, res) => {
  console.log('\n📨 Received attendance submission request');
  console.log('📦 Request headers:', req.headers);
  console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

  const { username, className, section, students, schoolCode } = req.body;

  // Validate input
  if (!username || !className || !section || !students || !Array.isArray(students)) {
    console.error('🚨 Invalid request data');
    return res.status(400).json({
      success: false,
      message: 'Invalid data. Please provide className, section, and students array.',
      received: {
        username: !!username,
        className: !!className,
        section: !!section,
        students: Array.isArray(students) ? students.length : 'invalid'
      }
    });
  }

  // Database connection
  const db = getDynamicDbConnection(schoolCode);
  if (!db) {
    console.error('🚨 Failed to establish database connection');
    return res.status(500).json({
      success: false,
      message: 'Database connection error.',
      schoolCode
    });
  }

  try {
    const currentDate = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const currentTime = moment().tz('Asia/Kolkata').format('HH:mm:ss');
    console.log(`\n📅 Processing attendance for date: ${currentDate} at ${currentTime}`);

    // Check for duplicate submissions
    const [existingRecords] = await db.promise().query(
      `SELECT COUNT(DISTINCT submission_time) AS submission_count 
       FROM attendance_frontend 
       WHERE class = ? AND section = ? AND date = ?`,
      [className, section, currentDate]
    );

    const submissionCount = existingRecords[0].submission_count;
    console.log(`📊 Existing submissions today: ${submissionCount}`);

    if (submissionCount >= 2) {
      console.warn('⚠️ Attendance submission limit reached');
      return res.status(400).json({
        success: false,
        message: 'Attendance for this class and section has already been submitted twice today.',
        submissionCount
      });
    }

    // Prepare attendance data
    const attendanceData = students.map(student => [
      student.username,
      student.name,
      className,
      section,
      student.leaves || 'No leave',
      currentDate,
      currentTime
    ]);

    console.log(`\n📝 Preparing to insert ${attendanceData.length} attendance records`);

    const insertQuery = `
      INSERT INTO attendance_frontend (username, name, class, section, leavetype, date, submission_time)
      VALUES ?`;

    // Execute database insertion
    db.query(insertQuery, [attendanceData], async (dbErr, dbResult) => {
      if (dbErr) {
        console.error('🚨 Database insertion error:', dbErr);
        return res.status(500).json({
          success: false,
          message: 'Database error.',
          error: dbErr.message
        });
      }

      console.log('\n✅ Attendance records inserted successfully');
      console.log('📊 Database result:', {
        affectedRows: dbResult.affectedRows,
        changedRows: dbResult.changedRows
      });

      // 🔔 Collect absent students for notification
      const absentStudents = [];

      for (const student of students) {
        if (['Informed', 'UnInformed'].includes(student.leaves)) {
          try {
            const [userResult] = await db.promise().query(
              'SELECT push_token FROM user_tokens WHERE username = ? LIMIT 1',
              [student.username]
            );

            if (userResult.length === 0) {
              console.warn(`⚠️ Push token not found for ${student.username}`);
              continue;
            }

            const pushToken = userResult[0].push_token;

            // Weekly & Monthly Absence Counts
            const currentWeekStart = moment().startOf('week').format('YYYY-MM-DD');
            const currentMonthStart = moment().startOf('month').format('YYYY-MM-DD');

            const [weeklyAbsence] = await db.promise().query(
              `SELECT COUNT(*) AS absent_count
               FROM attendance_frontend
               WHERE username = ? AND leavetype IN ('Informed', 'UnInformed') AND date >= ? AND date <= ?`,
              [student.username, currentWeekStart, currentDate]
            );

            const [monthlyAbsence] = await db.promise().query(
              `SELECT COUNT(*) AS absent_count
               FROM attendance_frontend
               WHERE username = ? AND leavetype IN ('Informed', 'UnInformed') AND date >= ? AND date <= ?`,
              [student.username, currentMonthStart, currentDate]
            );

            const weekCount = weeklyAbsence[0].absent_count;
            const monthCount = monthlyAbsence[0].absent_count;

            let message = `
Hello ${student.name},
You were marked absent today. Please ensure you catch up on your lessons and inform your teacher.`;

            if (weekCount >= 3) {
              message += `\n⚠️ You have been absent ${weekCount} times this week.`;
            }

            if (monthCount >= 5) {
              message += `\n⚠️ You have been absent ${monthCount} times this month.`;
            }

            absentStudents.push({
              username: student.username,
              name: student.name,
              pushToken,
              message
            });

          } catch (error) {
            console.error(`❌ Error processing student ${student.name}:`, error.message);
          }
        }
      }

      // 📲 Send Push Notifications
      if (absentStudents.length > 0) {
        for (const student of absentStudents) {
          await sendPushNotification(student.pushToken, student.message, student.username);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Attendance submitted and notifications sent successfully!',
      });
    });

  } catch (error) {
    console.error('❌ Error processing attendance:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

const sendPushNotification2 = async (pushToken, message) => {
    const messagePayload = {
      token: pushToken,
      notification: {
        title: 'Behavior Report Alert',
        body: message,
      },
    };
  
    try {
      const response = await admin.messaging().send(messagePayload);
      console.log('Notification sent successfully:', response);
    } catch (error) {
      console.error('Error sending notification:', error.message);
    }
  };
  
  // Endpoint to submit behavior report
  app.post('/api/submit', (req, res) => {
    const { username,name, class_name, section, report, comment,schoolCode } = req.body;
 
 
    // Validate inputs
    if (!username ||!name || !class_name || !section || !report) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    const db = getDynamicDbConnection(schoolCode);
  
    // Prepare SQL query to insert behavior report
    const sql = `INSERT INTO teachers_student_report (username,class_name, section, name, report, comment) VALUES (?, ?, ?, ?, ?,?)`;
  
    // Execute SQL query
    db.query(sql, [username,class_name, section, name, report, comment], async (err) => {
      if (err) {
        console.error('Error submitting report:', err);
        return res.status(500).json({ success: false, message: 'Failed to submit report.' });
      }
  
      try {
        // Fetch the FCM token for the student from the database
        const [userResult] = await db.promise().query(
          'SELECT push_token FROM user_tokens WHERE username = ? LIMIT 1',
          [username]
        );
  
        if (userResult.length > 0) {
          const pushToken = userResult[0].push_token;
          const notificationMessage = `Hello ${name}, a new behavior report has been submitted for you in class ${class_name}-${section}  ${report} ${comment}.`;
  
          // Send push notification
          await sendPushNotification2(pushToken, notificationMessage);
  
          res.status(200).json({
            success: true,
            message: 'Report submitted successfully, and notification sent!',
          });
        } else {
          console.warn(`Push token not found for student: ${name}`);
          res.status(200).json({
            success: true,
            message: 'Report submitted successfully, but push token not found for notification.',
          });
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError.message);
        res.status(500).json({
          success: true,
          message: 'Report submitted successfully, but notification failed to send.',
        });
      }
    });
  });



app.get('/api/get-notifications', (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'Missing schoolCode in request.' });
  }

  const db = getDynamicDbConnection(schoolCode);

  db.connect((err) => {
    if (err) {
      console.error('Database connection failed:', err);
      return res.status(500).json({ message: 'Database connection error.', error: err.message });
    }

    const query = `
      SELECT id, title, notification_text AS notificationText, date, recipient, priority
      FROM management_notifications
      WHERE LOWER(recipient) IN ('student', 'both')
      ORDER BY date DESC
    `;

    db.query(query, (error, results) => {
      db.end(); // ✅ close connection after query

      if (error) {
        console.error('Error retrieving data:', error);
        return res.status(500).json({ message: 'Error retrieving notifications.', error: error.message });
      }

      console.log('Notifications retrieved successfully:', results);
      res.status(200).json({ notifications: results });
    });
  });
});

// Handle GET request to retrieve notification count
app.get('/api/get-notification-count', (req, res) => {
    const query = `
        SELECT COUNT(*) AS count
        FROM management_notifications
        WHERE recipient IN ('student', 'both')  -- Only count notifications for 'Students' or 'Both'
    `;

    // No need to filter by recipient here unless needed, the query already filters notifications
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error retrieving notification count:', error);
            return res.status(500).json({ message: 'Error retrieving notification count.', error: error.message });
        }

        console.log('Notification count retrieved successfully:', results[0].count);
        res.status(200).json({ count: results[0].count });
    });
});




const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};


// Admin's location (this is just an example, replace with actual admin location)
const adminLocation = {
  latitude: 17.435019383931635, 
  longitude: 78.39263750972714
};



// Endpoint for marking attendance
app.post('/mark-attendance', (req, res) => {
  const { staffId, latitude, longitude } = req.body;

  // Validate input
  if (!staffId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Staff ID and location are required' });
  }

  // Log input coordinates for debugging
  console.log(`Received staffId: ${staffId}`);
  console.log(`Received location: Latitude: ${latitude}, Longitude: ${longitude}`);

  // Calculate distance between staff and admin locations
  const distance = calculateDistance(
      adminLocation.latitude,
      adminLocation.longitude,
      latitude,
      longitude
  );

  // Log the calculated distance for debugging
  console.log(`Calculated distance: ${distance} meters`);

  // Check if the distance is within the allowed range (200 meters now)
  if (distance <= 200) {
      // Mark attendance logic (e.g., save in database)
      res.status(200).json({ message: 'Attendance marked successfully', distance });
  } else {
      res.status(400).json({ error: 'You are outside the allowed range', distance });
  }
});


app.get('/academic_performance', (req, res) => {
  const { class_name, section, test_type } = req.query;

  if (!class_name || !section || !test_type) {
      return res.status(400).json({ error: 'Class, section, and test type are required.' });
  }

  const sql = `
      SELECT 
          name,
          subject,
          SUM(marks) AS marks
      FROM academic_performance_of_student
      WHERE class_name = ? AND section = ? AND test_type = ?
      GROUP BY name, subject
  `;

  db.query(sql, [class_name, section, test_type], (err, results) => {
      if (err) {
          console.error('Error fetching data:', err);
          return res.status(500).json({ error: 'Database query error.' });
      }

      // Transform results to the required structure
      const students = {};
      results.forEach(row => {
          if (!students[row.name]) {
              students[row.name] = { name: row.name, totalMarks: 0 };
          }
          students[row.name][row.subject.trim()] = parseFloat(row.marks); // Ensure marks are treated as numbers
          students[row.name].totalMarks += parseFloat(row.marks);
      });

      const records = Object.values(students);

      res.json({ records });
  });
});






app.use('/api',ScannerRoutes)
app.use('/api',main);  
app.use('/api',Notifications);
app.use('/api',leave);  
app.use('/api',leaveteacher);
app.use('/api',AttendanceNotification);
app.use('/api',driverStudentRoutes);  
app.use('/api',driversharingLocationRoutes);
app.use('/api',driverLoginRoutes);  
app.use('/api',busInsertionRoutes);  
app.use('/api', busManagerRoutes);
app.use('/api',parentBusRoutes);
app.use('/api',OverallTeacherNotificationsRouter);
app.use('/api', teachBehavRoutes);
app.use('/api', oopsRoutes);
app.use('/api', homework);
app.use('/api', Attendence);
app.use('/api',TeacherAcademicRoutes);
app.use('/api',managEventCal);
app.use('/api',ManagTimetable);
app.use('/api',TeacherTimetable);
app.use('/api',Photos);
app.use('/api',ParentTimetable);
app.use('/LiveChat', LiveChatRouter);
app.use('/api',ParentHomework);
app.use('/api',ExtraCurcularActivities)
app.use('/api',TeacherTimetableRetrive);
app.use('/api',notificationRouter);
app.use('/api',Fees);
app.use('/api',Managfee);
app.use('/api',Feeretrieve);
app.use('/parent-notifications',overallParentNotificationsRoutes);
app.use('/over-all-reports',overAllReportsRoutes);
app.use('/api',ManagementAcademicPerformance);
app.use('/api',LoginRoutes)
app.use('/api', HolidayNotification)
app.use('/api',SellerRoutes)
app.use('/api',attendancetracking)
// app.use('/api',parentNotification);

app.use('/api',bill)

app.use('/api',TeacherAttendanceretreival)


app.listen(3010, '0.0.0.0', () => {  // ✅ Accepts external connections
  console.log(`Server running on ============================http://0.0.0.0:3010`);
});



