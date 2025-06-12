/**
 * Calculates age based on birth date
 * @param {Date|string} birthDate - Birth date as Date object or ISO string
 * @returns {number} Age in years
 * @throws {Error} If birthDate is invalid or in the future
 */
function calculateAge(birthDate) {
    // Handle string input
    const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
    
    // Validate birth date
    if (isNaN(birth.getTime())) {
        throw new Error('Invalid birth date');
    }
    
    const today = new Date();
    
    // Check if birth date is in the future
    if (birth > today) {
        throw new Error('Birth date cannot be in the future');
    }
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

module.exports = {
    calculateAge
}; 