const pdfParse = require('pdf-parse');
const generateInterviewReport = require('../services/ai.service');
const interviewReportModel = require('../models/interviewReport.model');



async function generateInterviewReportController(req, res) {
    try {
        const { selfDescription, jobDescription } = req.body;
        if (!jobDescription || (!selfDescription && !req.file)) {
            return res.status(400).json({
                success: false,
                message: "Job description and either resume or self description are required"
            });
        }

        const resumeContent = req.file ? await pdfParse(req.file.buffer) : { text: "" };


        const interviewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription: selfDescription || "",
            jobDescription
        });


        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription: selfDescription || "",
            jobDescription,
            ...interviewReportByAi
        })
        res.status(201).json({
            success: true,
            message: "Interview report generated successfully",
            interviewReport
        })
    }
    catch (err) {
        console.log(err)
        res.status(500).json({
            success: false,
            message: "Failed to generate interview report"
        });
    }
}

async function getInterviewReportByIdController(req, res) {
    const { interviewId } = req.params;
    try {
        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found"
            })
        }

        res.status(200).json({
            success: true,
            message: "Interview report fetched successfully",
            interviewReport
        })
    }
    catch (err) {
        console.log(err)
        res.status(500).json({
            success: false,
            message: "Failed to fetch interview report"
        });
    }
}

async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = (await interviewReportModel.find({user : req.user.id})).sort({createdAt : -1}).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps ")
        res.status(200).json({
            success: true,
            message: "Interview reports fetched successfully",
            interviewReports
        })
    }
    catch (err) {
        console.log(err)
        res.status(500).json({
            success: false,
            message: "Failed to fetch interview reports"
        });
    }
}
    module.exports = { generateInterviewReportController, getInterviewReportByIdController , getAllInterviewReportsController};
