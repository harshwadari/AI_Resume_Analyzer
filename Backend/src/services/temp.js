const resume = `
John Doe
Software Engineer | john.doe@email.com | github.com/johndoe | linkedin.com/in/johndoe

EXPERIENCE
----------
Senior Frontend Engineer — TechCorp Pvt. Ltd. (2021 - Present)
- Built and maintained large-scale React applications serving 500K+ monthly active users
- Optimized bundle size by 40% using code splitting and lazy loading
- Led migration from REST to GraphQL, reducing API response times by 30%
- Mentored 3 junior developers and conducted weekly code reviews

Full Stack Developer — StartupXYZ (2019 - 2021)
- Developed RESTful APIs using Node.js and Express, integrated with MongoDB
- Implemented JWT-based authentication and role-based access control
- Deployed applications on AWS EC2 and S3 with CI/CD pipelines via GitHub Actions

SKILLS
------
Languages     : JavaScript (ES6+), TypeScript, HTML, CSS
Frontend      : React, Redux, Next.js, Tailwind CSS
Backend       : Node.js, Express.js
Databases     : MongoDB, MySQL (basic)
Tools         : Git, Docker (beginner), Postman, Figma
Cloud         : AWS (EC2, S3) — basic experience

EDUCATION
---------
B.Tech in Computer Science — Mumbai University (2015 - 2019)  |  CGPA: 7.8/10

PROJECTS
--------
- DevConnect: A developer networking platform built with MERN stack, WebSockets for real-time chat
- TaskFlow: Kanban board app with drag-and-drop, built using React and Node.js
`;

const selfDescription = `
I've spent the last 5 years working mostly on the frontend side of full-stack projects. 
React and JavaScript are where I feel most confident — I enjoy building clean, performant UIs 
and thinking about component architecture. 

On the backend, I've worked with Node.js and Express enough to be comfortable, 
but I wouldn't call myself a backend specialist. I've used MongoDB heavily but my SQL 
knowledge is pretty basic — I can write simple queries but I haven't worked with complex 
joins or query optimization.

I've used Docker a little bit but never set up a Kubernetes cluster or managed 
production-grade infrastructure. System design is an area I know I need to improve — 
I can design small systems but large-scale distributed systems concepts like 
consistent hashing, message queues, and sharding are things I've only read about 
superficially.

I work well in teams, adapt quickly, and I'm a fast learner. I'm looking to grow 
into a more well-rounded full-stack or backend-leaning role.
`;

const jobDescription = `
Role       : Full Stack Engineer (Mid-Senior Level)
Company    : FinEdge Technologies — a fintech startup building payment infrastructure

RESPONSIBILITIES
----------------
- Design and build scalable backend services using Node.js and TypeScript
- Work with both SQL (PostgreSQL) and NoSQL (MongoDB) databases
- Contribute to system design discussions for high-availability, distributed systems
- Build React-based internal dashboards and customer-facing UIs
- Write unit and integration tests (Jest, Supertest)
- Participate in on-call rotations and debug production incidents
- Collaborate with DevOps to manage deployments on Kubernetes/AWS EKS

REQUIREMENTS
------------
- 3+ years of full-stack experience with Node.js and React
- Strong TypeScript skills (mandatory)
- Proficiency in PostgreSQL — schema design, indexing, query optimization
- Solid understanding of system design — microservices, message queues (Kafka/RabbitMQ), caching (Redis)
- Experience with Docker and Kubernetes
- Familiarity with CI/CD pipelines
- Strong problem-solving skills and understanding of data structures & algorithms

NICE TO HAVE
------------
- Experience in fintech or payment systems
- Knowledge of GraphQL
- Contributions to open-source projects
`;

module.exports = {
    resume,
    selfDescription,
    jobDescription
};