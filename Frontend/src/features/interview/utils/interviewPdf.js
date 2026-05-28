const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 46;
const TOP_Y = 748;
const LINE_HEIGHT = 16;
const MAX_CHARS = 86;
const LINES_PER_PAGE = 42;

const sanitizeText = (value = "") =>
  String(value)
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapText = (text) => {
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > MAX_CHARS) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : [""];
};

const pushSection = (lines, title) => {
  lines.push("");
  lines.push(title.toUpperCase());
  lines.push("");
};

const buildReportLines = (report) => {
  const lines = [];

  lines.push(...wrapText(report.title || "Interview Report"));
  lines.push(`Match Score: ${report.matchScore ?? 0}%`);

  if (report.overallSummary) {
    pushSection(lines, "Summary");
    lines.push(...wrapText(report.overallSummary));
  }

  if (report.strengths?.length) {
    pushSection(lines, "Strengths");
    report.strengths.forEach((strength) => lines.push(...wrapText(`- ${strength}`)));
  }

  if (report.technicalQuestions?.length) {
    pushSection(lines, "Technical Questions");
    report.technicalQuestions.forEach((question, index) => {
      lines.push(...wrapText(`Q${index + 1}: ${question.question}`));
      lines.push(...wrapText(`Intention: ${question.intention}`));
      lines.push(...wrapText(`Model Answer: ${question.answer}`));
      lines.push("");
    });
  }

  if (report.behavioralQuestions?.length) {
    pushSection(lines, "Behavioral Questions");
    report.behavioralQuestions.forEach((question, index) => {
      lines.push(...wrapText(`Q${index + 1}: ${question.question}`));
      lines.push(...wrapText(`Intention: ${question.intention}`));
      lines.push(...wrapText(`Model Answer: ${question.answer}`));
      lines.push("");
    });
  }

  if (report.skillGaps?.length) {
    pushSection(lines, "Skill Gaps");
    report.skillGaps.forEach((gap) => {
      lines.push(...wrapText(`${gap.skill} (${gap.severity})`));
      if (gap.recommendation) {
        lines.push(...wrapText(`Recommendation: ${gap.recommendation}`));
      }
      lines.push("");
    });
  }

  if (report.preparationPlan?.length) {
    pushSection(lines, "Preparation Roadmap");
    report.preparationPlan.forEach((item) => {
      lines.push(...wrapText(`Day ${item.day}: ${item.focus}`));
      (item.tasks || []).forEach((task) => lines.push(...wrapText(`- ${task}`)));
      if (item.resources?.length) {
        lines.push(...wrapText(`Resources: ${item.resources.join(", ")}`));
      }
      lines.push("");
    });
  }

  return lines;
};

const chunkLines = (lines) => {
  const pages = [];
  for (let index = 0; index < lines.length; index += LINES_PER_PAGE) {
    pages.push(lines.slice(index, index + LINES_PER_PAGE));
  }
  return pages.length ? pages : [["Interview report"]];
};

const createPageStream = (pageLines) => {
  const commands = ["BT", "/F1 11 Tf", `${MARGIN_X} ${TOP_Y} Td`, `${LINE_HEIGHT} TL`];

  pageLines.forEach((line, index) => {
    if (index === 0) {
      commands.push(`(${sanitizeText(line)}) Tj`);
    } else {
      commands.push("T*");
      commands.push(`(${sanitizeText(line)}) Tj`);
    }
  });

  commands.push("ET");
  return commands.join("\n");
};

export const downloadInterviewReportPdf = (report) => {
  const pages = chunkLines(buildReportLines(report));
  const objects = [];
  const pageIds = [];
  let objectId = 3;

  pages.forEach((pageLines) => {
    const pageObjectId = objectId++;
    const contentObjectId = objectId++;
    pageIds.push(pageObjectId);
    objects.push({
      id: pageObjectId,
      content: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${objectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    });

    const stream = createPageStream(pageLines);
    objects.push({
      id: contentObjectId,
      content: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    });
  });

  const fontObjectId = objectId;
  objects.unshift({
    id: 2,
    content: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  });
  objects.unshift({
    id: 1,
    content: "<< /Type /Catalog /Pages 2 0 R >>"
  });
  objects.push({
    id: fontObjectId,
    content: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects
    .sort((first, second) => first.id - second.id)
    .forEach((object) => {
      offsets[object.id] = pdf.length;
      pdf += `${object.id} 0 obj\n${object.content}\nendobj\n`;
    });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${fontObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index <= fontObjectId; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${fontObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(report.title || "interview-report").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
