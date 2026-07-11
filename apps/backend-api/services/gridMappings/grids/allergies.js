module.exports = {
  title: '⚠️ Allergies',
  columns: ['Allergen', 'Reaction', 'Severity', 'Type'],
  deduplicate: (categoryData) => {
    const uniqueAllergies = new Map();
    categoryData.forEach(entry => {
      const allergenKey = (entry.allergen || entry.name || '').toLowerCase().trim();
      const reactionKey = (entry.reaction || '').toLowerCase().trim();
      const key = `${allergenKey}_${reactionKey}`;
      if (!uniqueAllergies.has(key) ||
          (uniqueAllergies.get(key).reportedBy === '' && entry.reportedBy !== '')) {
        uniqueAllergies.set(key, entry);
      }
    });
    return Array.from(uniqueAllergies.values());
  },
  mapper: (entry) => {
    // Infer allergy type if not provided
    let allergyType = entry.allergyType || entry.type || '';

    if (!allergyType || allergyType === '') {
      const allergen = (entry.allergen || entry.name || '').toLowerCase();

      // Common medication patterns
      const medications = [
        'penicillin', 'amoxicillin', 'ampicillin', 'aspirin', 'ibuprofen', 'naproxen', 'nsaid',
        'sulfa', 'sulfamethoxazole', 'trimethoprim', 'codeine', 'morphine', 'oxycodone', 'fentanyl',
        'contrast', 'dye', 'iodine', 'cephalosporin', 'ceftriaxone', 'azithromycin', 'erythromycin',
        'vancomycin', 'gentamicin', 'ciprofloxacin', 'levofloxacin', 'metronidazole', 'clindamycin',
        'warfarin', 'heparin', 'statin', 'metformin', 'insulin', 'lisinopril', 'metoprolol',
        'amlodipine', 'hydrochlorothiazide', 'prednisone', 'albuterol', 'levothyroxine',
        'acetaminophen', 'tylenol', 'advil', 'motrin', 'aleve', 'benadryl', 'zyrtec',
        'medication', 'drug', 'antibiotic', 'painkiller', 'vaccine', 'anesthesia', 'local anesthetic'
      ];

      // Common food patterns
      const foods = [
        'peanut', 'peanuts', 'tree nut', 'almond', 'walnut', 'cashew', 'pistachio', 'pecan',
        'shellfish', 'shrimp', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'scallop',
        'fish', 'salmon', 'tuna', 'cod', 'egg', 'eggs', 'milk', 'dairy', 'lactose', 'cheese',
        'wheat', 'gluten', 'soy', 'soybean', 'sesame', 'mustard', 'celery', 'lupin',
        'strawberry', 'kiwi', 'banana', 'avocado', 'tomato', 'citrus', 'chocolate', 'honey'
      ];

      // Common environmental/other patterns
      const environmental = [
        'pollen', 'grass', 'ragweed', 'tree pollen', 'birch', 'oak',
        'dust', 'dust mite', 'mold', 'mildew', 'fungus',
        'pet', 'cat', 'dog', 'dander', 'animal', 'horse', 'rabbit',
        'latex', 'rubber', 'nickel', 'fragrance', 'perfume', 'soap', 'detergent',
        'bee', 'wasp', 'hornet', 'yellow jacket', 'ant', 'mosquito', 'insect', 'bug',
        'cockroach', 'spider', 'fire ant'
      ];

      if (medications.some(med => allergen.includes(med))) {
        allergyType = 'Medication';
      } else if (foods.some(food => allergen.includes(food))) {
        allergyType = 'Food';
      } else if (environmental.some(env => allergen.includes(env))) {
        allergyType = 'Environmental';
      } else {
        allergyType = 'Other';
      }
    }

    return {
      'Allergen': (entry.allergen && entry.allergen !== '') ? entry.allergen : (entry.name || 'Unknown'),
      'Reaction': (entry.reaction && entry.reaction !== '') ? entry.reaction : '-',
      'Severity': (entry.severity && entry.severity !== '') ? entry.severity : 'Unknown',
      'Type': allergyType
    };
  }
};
