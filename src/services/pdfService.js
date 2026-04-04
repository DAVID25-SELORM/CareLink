import jsPDF from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'

/**
 * PDF Service
 * Utility functions for PDF generation and export across CareLink HMS
 * 
 * Author: David Gabion Selorm
 */

// Hospital branding configuration
const getHospitalConfig = (branding = {}) => ({
  name: branding.hospitalName || 'CareLink Hospital',
  branch: branding.branchName || '',
  platform: branding.platformName || 'CareLink HMS',
  address: branding.address || '',
  phone: branding.phone || '',
  email: branding.email || ''
})

// Add header to PDF
const addPDFHeader = (doc, config, title) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Logo/Hospital Name
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(config.name, pageWidth / 2, 15, { align: 'center' })
  
  if (config.branch) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(config.branch, pageWidth / 2, 21, { align: 'center' })
  }
  
  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, pageWidth / 2, 30, { align: 'center' })
  
  // Line separator
  doc.setLineWidth(0.5)
  doc.line(15, 35, pageWidth - 15, 35)
  
  return 40 // Return Y position after header
}

// Add footer to all pages
const addPDFFooter = (doc, config) => {
  const pageCount = doc.internal.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    // Footer text
    doc.text(
      `${config.platform} • Generated on ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
    
    // Page numbers
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 15,
      pageHeight - 10,
      { align: 'right' }
    )
  }
}

/**
 * Generate Prescription PDF
 */
export const generatePrescriptionPDF = (prescription, items, branding = {}) => {
  const doc = new jsPDF()
  const config = getHospitalConfig(branding)
  
  let yPos = addPDFHeader(doc, config, 'PRESCRIPTION')
  
  // Patient Information
  yPos += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Patient Information:', 15, yPos)
  
  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Name: ${prescription.patients?.name || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Phone: ${prescription.patients?.phone || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Date: ${new Date(prescription.created_at).toLocaleDateString()}`, 15, yPos)
  
  // Doctor Information
  yPos += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Prescribed by:', 15, yPos)
  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Dr. ${prescription.users?.full_name || prescription.users?.email || 'CareLink Doctor'}`, 15, yPos)
  
  // Diagnosis
  if (prescription.diagnosis) {
    yPos += 10
    doc.setFont('helvetica', 'bold')
    doc.text('Diagnosis:', 15, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    doc.text(prescription.diagnosis, 15, yPos)
  }
  
  // Prescription Items Table
  yPos += 10
  doc.autoTable({
    startY: yPos,
    head: [['Medication', 'Dosage', 'Frequency', 'Duration', 'Qty', 'Instructions']],
    body: items.map(item => [
      item.drug_name || '',
      item.dosage || '',
      item.frequency || '',
      item.duration || '',
      item.quantity || '',
      item.instructions || ''
    ]),
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 }
  })
  
  // Notes
  if (prescription.notes) {
    yPos = doc.lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', 15, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    doc.text(prescription.notes, 15, yPos, { maxWidth: 180 })
  }
  
  addPDFFooter(doc, config)
  
  return doc
}

/**
 * Generate Billing Receipt PDF
 */
export const generateBillingReceiptPDF = (prescription, items, payment, branding = {}) => {
  const doc = new jsPDF()
  const config = getHospitalConfig(branding)
  
  let yPos = addPDFHeader(doc, config, 'PAYMENT RECEIPT')
  
  // Receipt Details
  yPos += 10
  doc.setFontSize(10)
  doc.text(`Receipt #: RCP-${payment.id?.toString().padStart(6, '0')}`, 15, yPos)
  yPos += 5
  doc.text(`Date: ${new Date(payment.created_at || Date.now()).toLocaleDateString()}`, 15, yPos)
  yPos += 5
  doc.text(`Time: ${new Date(payment.created_at || Date.now()).toLocaleTimeString()}`, 15, yPos)
  
  // Patient Information
  yPos += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Patient Information:', 15, yPos)
  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Name: ${prescription.patients?.name || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Phone: ${prescription.patients?.phone || 'N/A'}`, 15, yPos)
  
  // Items Table
  yPos += 10
  const tableData = items.map(item => [
    item.drugs?.name || item.drug_name || 'N/A',
    item.quantity || 0,
    `GH₵ ${(item.drugs?.price || 0).toFixed(2)}`,
    `GH₵ ${((item.drugs?.price || 0) * (item.quantity || 0)).toFixed(2)}`
  ])
  
  const total = items.reduce((sum, item) => 
    sum + (item.drugs?.price || 0) * (item.quantity || 0), 0
  )
  
  doc.autoTable({
    startY: yPos,
    head: [['Item', 'Quantity', 'Unit Price', 'Total']],
    body: tableData,
    foot: [[{ content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, 
            `GH₵ ${total.toFixed(2)}`]],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' }
  })
  
  yPos = doc.lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.text(`Payment Method: ${payment.payment_method?.toUpperCase() || 'N/A'}`, 15, yPos)
  yPos += 6
  doc.text(`Status: ${payment.status?.toUpperCase() || 'COMPLETED'}`, 15, yPos)
  
  // Thank you message
  yPos += 15
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text('Thank you for choosing our services!', doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' })
  
  addPDFFooter(doc, config)
  
  return doc
}

/**
 * Generate Lab Test Result PDF
 */
export const generateLabResultPDF = (labTest, branding = {}) => {
  const doc = new jsPDF()
  const config = getHospitalConfig(branding)
  
  let yPos = addPDFHeader(doc, config, 'LABORATORY TEST RESULT')
  
  // Test Information
  yPos += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Test Information:', 15, yPos)
  
  yPos += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Test ID: ${labTest.id}`, 15, yPos)
  yPos += 5
  doc.text(`Test Name: ${labTest.test_name}`, 15, yPos)
  yPos += 5
  doc.text(`Test Type: ${labTest.test_type}`, 15, yPos)
  yPos += 5
  doc.text(`Date Requested: ${new Date(labTest.created_at).toLocaleDateString()}`, 15, yPos)
  yPos += 5
  doc.text(`Date Completed: ${labTest.completed_at ? new Date(labTest.completed_at).toLocaleDateString() : 'Pending'}`, 15, yPos)
  
  // Patient Information
  yPos += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Patient Information:', 15, yPos)
  yPos += 7
  doc.setFont('helvetica', 'normal')
  doc.text(`Name: ${labTest.patients?.name || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Phone: ${labTest.patients?.phone || 'N/A'}`, 15, yPos)
  
  // Test Results
  yPos += 15
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TEST RESULTS', 15, yPos)
  
  yPos += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  if (labTest.result) {
    const splitResult = doc.splitTextToSize(labTest.result, 180)
    doc.text(splitResult, 15, yPos)
    yPos += splitResult.length * 5
  } else {
    doc.text('Results pending...', 15, yPos)
  }
  
  // Notes
  if (labTest.notes) {
    yPos += 10
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', 15, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    const splitNotes = doc.splitTextToSize(labTest.notes, 180)
    doc.text(splitNotes, 15, yPos)
  }
  
  // Status
  yPos += 15
  doc.setFont('helvetica', 'bold')
  doc.text(`Status: ${labTest.status?.toUpperCase() || 'PENDING'}`, 15, yPos)
  
  addPDFFooter(doc, config)
  
  return doc
}

/**
 * Generate Claims Report PDF
 */
export const generateClaimPDF = (claim, branding = {}) => {
  const doc = new jsPDF()
  const config = getHospitalConfig(branding)
  
  let yPos = addPDFHeader(doc, config, 'INSURANCE CLAIM FORM')
  
  // Claim Information
  yPos += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Claim Information:', 15, yPos)
  
  yPos += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Claim ID: ${claim.id}`, 15, yPos)
  yPos += 5
  doc.text(`Claim Type: ${claim.claim_type?.toUpperCase() || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Amount: GH₵ ${(claim.amount || 0).toFixed(2)}`, 15, yPos)
  yPos += 5
  doc.text(`Status: ${claim.status?.toUpperCase() || 'PENDING'}`, 15, yPos)
  yPos += 5
  doc.text(`Date Filed: ${new Date(claim.created_at).toLocaleDateString()}`, 15, yPos)
  
  if (claim.submitted_at) {
    yPos += 5
    doc.text(`Date Submitted: ${new Date(claim.submitted_at).toLocaleDateString()}`, 15, yPos)
  }
  
  if (claim.approved_at) {
    yPos += 5
    doc.text(`Date Approved: ${new Date(claim.approved_at).toLocaleDateString()}`, 15, yPos)
  }
  
  // Patient Information
  yPos += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Patient Information:', 15, yPos)
  yPos += 7
  doc.setFont('helvetica', 'normal')
  doc.text(`Name: ${claim.patients?.name || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Phone: ${claim.patients?.phone || 'N/A'}`, 15, yPos)
  
  // Service Details
  if (claim.service_description) {
    yPos += 10
    doc.setFont('helvetica', 'bold')
    doc.text('Service Description:', 15, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    const splitDesc = doc.splitTextToSize(claim.service_description, 180)
    doc.text(splitDesc, 15, yPos)
  }
  
  addPDFFooter(doc, config)
  
  return doc
}

/**
 * Generate Patient Record PDF
 */
export const generatePatientRecordPDF = (patient, branding = {}) => {
  const doc = new jsPDF()
  const config = getHospitalConfig(branding)
  
  let yPos = addPDFHeader(doc, config, 'PATIENT RECORD')
  
  // Patient Information
  yPos += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Personal Information:', 15, yPos)
  
  yPos += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Name: ${patient.name}`, 15, yPos)
  yPos += 5
  doc.text(`Date of Birth: ${patient.dob || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Age: ${patient.age || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Gender: ${patient.gender || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Phone: ${patient.phone}`, 15, yPos)
  yPos += 5
  doc.text(`Email: ${patient.email || 'N/A'}`, 15, yPos)
  yPos += 5
  doc.text(`Address: ${patient.address || 'N/A'}`, 15, yPos)
  
  // Insurance Information
  yPos += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Insurance Information:', 15, yPos)
  yPos += 7
  doc.setFont('helvetica', 'normal')
  doc.text(`Insurance Type: ${patient.insurance_type?.toUpperCase() || 'NONE'}`, 15, yPos)
  
  if (patient.insurance_type === 'nhis') {
    yPos += 5
    doc.text(`NHIS Number: ${patient.nhis_number || 'N/A'}`, 15, yPos)
  } else if (patient.insurance_type === 'private') {
    yPos += 5
    doc.text(`Insurance Provider: ${patient.insurance_name || 'N/A'}`, 15, yPos)
    yPos += 5
    doc.text(`Policy Number: ${patient.insurance_number || 'N/A'}`, 15, yPos)
  }
  
  // Medical Information
  if (patient.blood_group || patient.allergies || patient.medical_history) {
    yPos += 10
    doc.setFont('helvetica', 'bold')
    doc.text('Medical Information:', 15, yPos)
    yPos += 7
    doc.setFont('helvetica', 'normal')
    
    if (patient.blood_group) {
      doc.text(`Blood Group: ${patient.blood_group}`, 15, yPos)
      yPos += 5
    }
    
    if (patient.allergies) {
      doc.text(`Allergies: ${patient.allergies}`, 15, yPos)
      yPos += 5
    }
    
    if (patient.medical_history) {
      doc.text('Medical History:', 15, yPos)
      yPos += 5
      const splitHistory = doc.splitTextToSize(patient.medical_history, 180)
      doc.text(splitHistory, 15, yPos)
    }
  }
  
  // Registration Info
  yPos += 10
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text(`Registered on: ${new Date(patient.created_at).toLocaleDateString()}`, 15, yPos)
  
  addPDFFooter(doc, config)
  
  return doc
}

/**
 * Generate Reports/Analytics PDF
 */
export const generateAnalyticsReportPDF = (analytics, branding = {}) => {
  const doc = new jsPDF()
  const config = getHospitalConfig(branding)
  
  let yPos = addPDFHeader(doc, config, 'ANALYTICS REPORT')
  
  // Summary Statistics
  yPos += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary Statistics:', 15, yPos)
  
  yPos += 10
  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Total Patients', analytics.totalPatients?.toString() || '0'],
      ['Total Prescriptions', analytics.totalPrescriptions?.toString() || '0'],
      ['Total Revenue', `GH₵ ${(analytics.totalRevenue || 0).toFixed(2)}`],
      ['Total Claims', analytics.totalClaims?.toString() || '0'],
      ['Pending Claims', analytics.pendingClaims?.toString() || '0'],
      ['Approved Claims', analytics.approvedClaims?.toString() || '0'],
      ['Low Stock Drugs', analytics.lowStockDrugs?.toString() || '0']
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] }
  })
  
  // Revenue by Payment Method
  if (analytics.revenueByMethod && analytics.revenueByMethod.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Revenue by Payment Method:', 15, yPos)
    
    yPos += 5
    doc.autoTable({
      startY: yPos,
      head: [['Payment Method', 'Amount']],
      body: analytics.revenueByMethod.map(item => [
        item.name?.toUpperCase() || 'N/A',
        `GH₵ ${(item.value || 0).toFixed(2)}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    })
  }
  
  // Top Drugs
  if (analytics.topDrugs && analytics.topDrugs.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15
    
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Top Prescribed Drugs:', 15, yPos)
    
    yPos += 5
    doc.autoTable({
      startY: yPos,
      head: [['Drug Name', 'Quantity Prescribed']],
      body: analytics.topDrugs.map(drug => [
        drug.name || 'N/A',
        drug.count?.toString() || '0'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    })
  }
  
  addPDFFooter(doc, config)
  
  return doc
}

/**
 * Capture HTML element as PDF
 */
export const captureElementAsPDF = async (elementId, filename = 'document.pdf') => {
  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`)
  }
  
  const canvas = await html2canvas(element, {
    scale: 2,
    logging: false,
    useCORS: true
  })
  
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  })
  
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
  pdf.save(filename)
}

/**
 * Download PDF
 */
export const downloadPDF = (doc, filename = 'document.pdf') => {
  doc.save(filename)
}

/**
 * Print PDF
 */
export const printPDF = (doc) => {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.contentWindow.print()
  
  // Clean up after printing
  setTimeout(() => {
    document.body.removeChild(iframe)
    URL.revokeObjectURL(url)
  }, 1000)
}
