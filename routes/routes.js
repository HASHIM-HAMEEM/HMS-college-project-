const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const connection = require("../dbconnection");
const nodemailer = require("nodemailer");
const fs = require('fs').promises;
const QRCode = require('qrcode');




// const mongoose = require("mongoose");

// Models
const Student = require('../DbModels/ModelStudentdetails'); 
const Wallet = require('../DbModels/ModelWallet');
const Transaction = require('../DbModels/ModelTransaction');
const Admin = require ( '../DbModels/ModelAdmin');

const multer = require("multer");
require("dotenv").config();
var uuid = require("uuid");

const { response, json, query } = require("express");
const { appendFile } = require("fs");

var router = express.Router();
router.use(cookieParser());

// flash message midelware
router.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

// Set up Multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/"); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// validate if Usser is  Loggedin
function validateLogin(req, res, next) {
  if (!req.session.loggedin) {
    req.session.message = {
      type: "danger",
      message: "Please Log in to continue",
    };
    res.redirect("/Login");
  } else {
    next();
  }
}

// send email Email  function
function sendEmail(email, esubject, etext) {
  let testAccount = nodemailer.createTestAccount();

  console.log(process.env.EMAIL + process.env.EMAIL_PASS);
  var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });

  var mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: esubject,
    text: etext,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

/* GET home page. done */ 
const resultsPerPage = 20;
router.get("/", validateLogin, async function (req, res, next) {
  try {
    const totalCount = await Student.countDocuments({ s_approved: "approved" });
    const numberOfPages = Math.ceil(totalCount / resultsPerPage);
    let page = req.query.page ? Number(req.query.page) : 1;

    if (page > numberOfPages) {
        return res.redirect("/?page=" + encodeURIComponent(numberOfPages));
    } else if (page < 1) {
        return res.redirect("/?page=" + encodeURIComponent("1"));
    }

    const startingLimit = (page - 1) * resultsPerPage;
    const students = await Student.find({ s_approved: "approved" })
        .skip(startingLimit)
        .limit(resultsPerPage)
        .lean(); // Use lean() for better performance if you don't need Mongoose documents

    let iterator = page - 5 < 1 ? 1 : page - 5;
    let endingLink = iterator + 9 <= numberOfPages
        ? iterator + 9
        : page + (numberOfPages - page);
    
    if (endingLink < page + 4) {
        iterator -= page + 4 - numberOfPages;
    }

    res.render("index", {
        title: "Admin Dashboard",
        data: students,
        page,
        iterator,
        endingLink,
        numberOfPages,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send("An error occurred. Please try again.");
  }
});

//login page
router.get("/Login", function (req, res, next) {
  res.render("login", {
    title: "LogIn Page",
    code1: res.statusCode,
  });
  // console.log("statusCode: ", res.statusCode);
});


// Login POST done
router.post("/Login", async function (request, response) {
  let { email, password } = request.body;

  if (email && password) {
    try {
      const admin = await Admin.findOne({ a_email: email, a_password: password });

      if (admin) {
        request.session.loggedin = true;
        request.session.email = email;
        request.session.message = {
          type: "success",
          message: "Logged in Successfully",
        };
        return response.redirect("/");
      } else {
        request.session.message = {
          type: "danger",
          message: "Invalid Email or Password",
        };
        return response.redirect("/Login");
      }
    } catch (error) {
      console.error("Database error:", error);
      request.session.message = {
        type: "danger",
        message: "An error occurred. Please try again.",
      };
      return response.redirect("/Login");
    }
  } else {
    request.session.message = {
      type: "danger",
      message: "Please enter Required data",
    };
    return response.redirect("/Login");
  }
});

//LOG OUT
router.get("/logout", function (req, res, next) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        res.status(400);
        return res.redirect("/Login");
      }
    });
  }
});

// Pending students done
router.get("/Pending_Students", validateLogin, async function (req, res, next) {
  try {
    const result = await Student.find({ s_approved: "pending" }).lean();
    res.render("pages/pending_students", {
      title: "Pending Students",
      data1: result,
    });
  } catch (error) {
    next(error);
  }
});

// Pending student details Rollno done
router.get("/Pending_Students/:rollno", validateLogin, async function (req, res, next) {
  try {
    const result = await Student.findOne({ s_rollno: req.params.rollno }).lean();
    res.render("pages/pending_student_details", {
      title: "Pending Student Details",
      data2: [result], // Wrapping in array to maintain compatibility with existing view
    });
  } catch (error) {
    next(error);
  }
});

// Pending student details Rollno POST done
router.post("/Pending_Students/:rollno", validateLogin, async function (req, res, next) {
  try {
    if (req.body.allow == "allow") {
      const student = await Student.findOne({ s_rollno: req.params.rollno });
      const qrdata = `${student.s_rollno}:${student.s_name}:${student.s_phone}`;
      const qrcodeStr = await QRCode.toDataURL(qrdata);

      await Student.updateOne(
        { s_rollno: req.params.rollno },
        {
          $set: {
            s_status: "active",
            s_approved: "approved",
            s_note_emp: req.body.note,
            s_hostal_details: req.body.hostal_details,
            s_qrcode: qrcodeStr,
          },
        }
      );

      await Wallet.create({
        student_id: req.params.rollno,
        amount: 0,
        remark: "none",
      });

      sendEmail(
        student.s_email,
        "KGP SRINAGAR HOSTEL",
        "You have been selected in our college hostel"
      );

      req.session.message = {
        type: "success",
        message: "Student Approved !!",
      };
    } else {
      await Student.updateOne(
        { s_rollno: req.params.rollno },
        {
          $set: {
            s_status: "discard",
            s_approved: "discard",
            s_note_emp: req.body.note,
          },
        }
      );

      sendEmail(
        req.body.s_email,
        "KGP SRINAGAR HOSTEL",
        `Sorry!! You are not selected in our college hostel because of the reason: ${req.body.note}`
      );

      req.session.message = {
        type: "danger",
        message: "Student Discarded!!",
      };
    }
    res.redirect("/Pending_Students");
  } catch (error) {
    next(error);
  }
});


// student details roll no GET done
router.get("/Student-Details/:rollno", validateLogin, async function (req, res, next) {
  try {
    const rollno = req.params.rollno;
    console.log("Roll No:", rollno);

    

    // Find student
    const student = await Student.findOne({ s_rollno: rollno }).lean();
    if (!student) {
      return res.status(404).send("Student not found");
    }
    // QR code generation 
     // Prepare student details for QR code
    const studentDetails = JSON.stringify({
      name: student.s_name,
      rollno: student.s_rollno,
      email: student.s_email,
      // Add any other details you want in the QR code
    });

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(studentDetails);


    // Find transactions
    const transactions = await Transaction.find({ student_id: rollno }).lean();
    console.log("Transactions:", transactions);

    // Find wallet
    const wallet = await Wallet.findOne({ student_id: rollno }).lean();
    console.log("Wallet:", wallet);

    res.render("pages/student_details.ejs", {
      title: "Student Details",
      data3: [student], // Wrapping in array to maintain compatibility with existing view
      amount: wallet ? wallet.amount : 0,
      trandata: transactions,
       qrCodeDataURL: qrCodeDataURL
    });
  } catch (error) {
    console.error("Error in Student-Details route:", error);
    next(error);
  }
});


/// Edit student with roll no done GET
router.get("/Edit_Student/:rollno", validateLogin, async (req, res, next) => {
  try {
    const student = await Student.findOne({ s_rollno: req.params.rollno }).lean();
    res.render("pages/edit_student", {
      title: "Edit Student Details",
      data2: [student], // Wrapping in array to maintain compatibility with existing view
    });
  } catch (error) {
    next(error);
  }
});



// Edit student with roll no POST done 
router.post("/Edit_Student/:rollno",  validateLogin,async (req, res, next) => {
  try {
   
   const result = await Student.findOneAndUpdate(
  { s_rollno: req.params.rollno },
  {
    $set: {
      s_rollno: req.body.s_rollno,
      s_name: req.body.s_name,
      s_parantage: req.body.s_parantage,
      s_phone: req.body.s_phone,
      s_email: req.body.s_email,
      s_address: req.body.s_address,
      s_pincode: req.body.s_pincode,
      s_dob: req.body.s_dob,
      s_dateadm: req.body.s_dateadm,
      s_roomNo: req.body.s_roomNo,
    },
  },
  { new: true, runValidators: false }
);
   

    if (!result) {
      req.session.message = {
        type: "warning",
        message: "Student not found or no changes were made.",
      };
    } else {
      req.session.message = {
        type: "success",
        message: "Student Updated Successfully!",
      };
    }

    res.redirect("/Student-Details/" + (result ? result.s_rollno : req.params.rollno));
  } catch (error) {
    console.error("Error updating student:", error);
    req.session.message = {
      type: "danger",
      message: "Error updating student: " + error.message,
    };
    res.redirect("/Edit_Student/" + req.params.rollno);
  }
});


//add money done 
router.get("/Add_Money/:rollno", validateLogin, (req, res, next) => {
  res.render("pages/add_money", {
    title: "Add Money",
    puser: req.params.rollno,
  });
});
// Add money POST
router.post("/Add_Money/:rollno", validateLogin, async (req, res, next) => {
  try {
    // Update wallet
    const updatedWallet = await Wallet.findOneAndUpdate(
      { student_id: req.params.rollno },
      { 
        $inc: { amount: Number(req.body.amount) },
        $set: { 
          remark: req.body.remark || "Amount added",
          date: new Date()
        }
      },
      { new: true, upsert: true } // Create if doesn't exist, return updated document
    );

    // Create transaction
    const Tid = uuid.v4();
    const newTransaction = new Transaction({
      student_id: req.params.rollno,
      dt_ct: "ct",
      transiction_id: `${req.params.rollno}-UHFTA-${Tid}`,
      amount: Number(req.body.amount),
      remarks: req.body.remark || "Amount added",
      date: new Date()
    });
    await newTransaction.save();

    req.session.message = {
      type: "success",
      message: "Amount Added !!",
    };
    res.redirect("/Student-Details/" + req.params.rollno);
  } catch (error) {
    console.error("Error adding money:", error);
    next(error);
  }
});

// Edit status POST
router.post("/edit_status/:rollno", validateLogin, async (req, res, next) => {
  try {
    await Student.updateOne(
      { s_rollno: req.params.rollno },
      { $set: { s_status: req.body.status } }
    );
    req.session.message = {
      type: "success",
      message: "Student Updated Successfully",
    };
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// For searching student
router.get("/search", validateLogin, async function (req, res, next) {
  try {
    const students = await Student.find(
      { s_rollno: { $regex: req.query.search, $options: "i" } },
      { s_rollno: 1, s_name: 1 }
    ).lean();

    const data = students.map((student) => student.s_name);
    res.render("pages/test", { data: JSON.stringify(data) });
  } catch (error) {
    next(error);
  }
});


router.get("/Print_Card/:rollno", validateLogin, async (req, res, next) => {
  try {
    const student = await Student.findOne(
      { s_rollno: req.params.rollno },
      { s_name: 1, s_rollno: 1, s_phone: 1, s_email: 1, s_parantage: 1 }
    ).lean();

    if (!student) {
      throw new Error('Student not found');
    }

    // Prepare student details for QR code
    const studentDetails = JSON.stringify({
      name: student.s_name,
      rollno: student.s_rollno,
      phone: student.s_phone,
      email: student.s_email
    });

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(studentDetails);

    res.render("pages/qrcard", {
      title: "Student ID Card",
      student: student,
      qrCodeDataURL: qrCodeDataURL
    });
  } catch (error) {
    next(error);
  }
});


// Discarded_Students
router.get("/Discarded_Students", validateLogin, async (req, res, next) => {
  try {
    const discardedStudents = await Student.find({ s_approved: "discarded" }).lean();
    res.render("pages/discarded_students", {
      title: "Discarded Students",
      data: discardedStudents,
    });
  } catch (error) {
    next(error);
  }
});

// Delete student
router.post("/Delete_Student/:rollno", validateLogin, async (req, res) => {
  try {
    const result = await Student.findOneAndUpdate(
      { s_rollno: req.params.rollno },
      { $set: { s_approved: "discarded" } },
      { new: true }
    );

    if (result) {
      req.session.message = {
        type: "success",
        message: "Student discarded successfully!",
      };
    } else {
      req.session.message = {
        type: "warning",
        message: "Student not found.",
      };
    }
    res.redirect("/Discarded_Students");
  } catch (error) {
    console.error("Error discarding student:", error);
    req.session.message = {
      type: "danger",
      message: "Error discarding student: " + error.message,
    };
    res.redirect("/students"); // or wherever you want to redirect on error
  }
});




// Email services
router.get("/Email_Service", validateLogin, (req, res, next) => {
  res.render("pages/email_services", {
    title: "Email Services ",
  });
});

// Email services POST
router.post("/Email_Service", async (req, res, next) => {
  try {
    const activeStudents = await Student.find(
      { s_status: "active" },
      { s_email: 1 }
    ).lean();
    const maillist = activeStudents.map((student) => student.s_email);

    await sendEmail(maillist, req.body.esubject, req.body.econtent);

    req.session.message = {
      type: "success",
      message: "Email Sent To All Students Successfully !!",
    };
    res.redirect("/Email_Service");
  } catch (error) {
    next(error);
  }
});


// Add student GET
router.get("/add_student", validateLogin, (req, res, next) => {
  res.render("pages/add_student", {
    title: "Add Student ",
  });
});

// ADD student POST

router.post("/Add_Student", upload.single("simage"), async (req, res) => {
  try {
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }
    // Connect to the database
    //const db = await connectToDatabase();
    // const studentsCollection = db.collection("StudentDetails");

    // Create new student object
    const newStudent = new Student({
      s_name: req.body.sname,
      s_email: req.body.semail,
      s_address: req.body.saddress,
      s_phone: req.body.sphone,
      s_dob: req.body.sdob,
      s_roomNo: req.body.sroomNo,
      s_parantage: req.body.sparantage,
      s_photo: `/${req.file.filename}`,
      s_password: req.body.sdob,
      s_pincode: req.body.spincode,
      s_rollno: req.body.srollno,
      s_dateadm: req.body.sdateadm
    });

    // console.log(newStudent);

    // Save the new student to the database
    const result = await newStudent.save();
    

    if (result) {
      req.session.message = {
        type: "success",
        message: "Student added Successfully"
      };
      res.redirect("/Add_Student");
    } else {
      throw new Error("Failed to insert student");
    }
  } catch (error) {
    console.error("Error adding student:", error);
    if (error.code === 11000) {
      // Duplicate key error
      // res.status(400).send("A student with this USN or email already exists.");
      req.session.message = {
        type: "danger",
        message: "Student not added ",
      };
      res.redirect("/Add_Student");
    } else {
      // res.status(500).send("Error adding student. Please try again.");
      req.session.message = {
        type: "danger",
        message: "Error adding student ",
      };
      res.redirect("/Add_Student");
    }
  }
});

// update image POST 

router.post("/updateimage", upload.single('s_photo'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const student = await Student.findOne({ s_rollno: req.body.s_rollno });
    if (!student) {
      throw new Error('Student not found');
    }

    // Delete the old image if it exists
    if (student.s_photo) {
      const oldImagePath = path.join(__dirname, '..', 'uploads', student.s_photo);
      await fs.unlink(oldImagePath).catch(err => console.error('Failed to delete old image:', err));
    }

    // Update the student record with the new image filename
    student.s_photo = req.file.filename;
    await student.save();

    req.session.message = {
      type: "success",
      message: "Profile image updated successfully!",
    };
    res.redirect(`/Student-Details/${student.s_rollno}`); // Redirect to the student's detail page
  } catch (error) {
    console.error("Error updating image:", error);
    req.session.message = {
      type: "danger",
      message: "Error updating image: " + error.message,
    };
    res.redirect('back'); // Redirect back to the previous page
  }
});

module.exports = router;
