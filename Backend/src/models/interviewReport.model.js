const mongoose = require('mongoose')

// ✅ All sub-schemas defined FIRST before use

const technicalQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, "Question is required"]
    },
    intention: {
        type: String,
        required: [true, "Intention is required"]
    },
    answer: {
        type: String,
        required: [true, "Answer is required"]
    }
}, { _id: false })


const behaviouralQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, "Question is required"]
    },
    intention: {
        type: String,
        required: [true, "Intention is required"]
    },
    answer: {
        type: String,
        required: [true, "Answer is required"]
    }
}, { _id: false })


const skillGapSchema = new mongoose.Schema({
    skill: {
        type: String,
        required: [true, "Skill is required"]
    },
    severity: {
        type: String,
        enum: ["low", "medium", "high"]
    },
    recommendation: {
        type: String,
        required: [true, "Recommendation is required"]
    }
    
}, { _id: false })


const preparationPlanSchema = new mongoose.Schema({
    day: {
        type: Number,
        required: [true, "Day is required"]
    },
    focus: {
        type: String,
        required: [true, "Focus is required"]
    },
    tasks: [{
        type: String
    }],
    resources: [{
        type: String
    }],
    
}, )


// Main schema defined AFTER all sub-schemas
const interviewReportSchema = new mongoose.Schema({
    jobDescription: {
        type: String,
        required: true
    },
    resume: {
        type: String
    },
    selfDescription: {
        type: String
    },
    matchScore: {
        type: Number,
        min: 0,
        max: 100
    },
    technicalQuestions: [technicalQuestionSchema],    
    behavioralQuestions: [behaviouralQuestionSchema], 
    skillGaps: [skillGapSchema],                      
    preparationPlan: [preparationPlanSchema],          
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Users",
        
    },
    title : {
        type : String,
        required : [true, "job title is required "]
    }

}, {
    timestamps: true
})

const interviewReportModel = mongoose.model("InterviewReport", interviewReportSchema)

module.exports = interviewReportModel
