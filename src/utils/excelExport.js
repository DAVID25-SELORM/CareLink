import * as XLSX from 'xlsx'

/**
 * Excel Export Utility
 * Export data tables to Excel format
 * Author: David Gabion Selorm
 */

export const exportToExcel = (data, fileName = 'export', sheetName = 'Sheet1') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`)
    return true
  } catch (error) {
    console.error('Excel export error:', error)
    return false
  }
}

export const exportMultipleSheets = (sheets, fileName = 'export') => {
  try {
    const workbook = XLSX.utils.book_new()
    
    sheets.forEach(({ data, name }) => {
      const worksheet = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(workbook, worksheet, name)
    })
    
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`)
    return true
  } catch (error) {
    console.error('Excel export error:', error)
    return false
  }
}
