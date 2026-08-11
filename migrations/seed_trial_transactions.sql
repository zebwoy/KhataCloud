-- Flush the trial_transactions table
DELETE FROM trial_transactions;

-- Reset the sequence (if using SERIAL id)
ALTER SEQUENCE trial_transactions_id_seq RESTART WITH 1;

-- Seed with general sample data (~30 transactions covering all cases)
-- Note: For Income - sender gives money to receiver (Organization)
--       For Expense - sender (Organization) pays receiver (vendor/supplier)

INSERT INTO trial_transactions (date, category, subcategory, sender, receiver, remarks, amount, IsDeleted) VALUES
-- Income transactions - various subcategories (Donors/Entities sending money to Organization)
('2024-11-15', 'Income', 'Donations', 'Community Donor A', 'Organization', 'Deposit', 50000.00, 'N'),
('2024-11-20', 'Income', 'Student Fees', 'Student Fees Collection', 'Organization', 'Rent Classroom', 25000.00, 'N'),
('2024-11-25', 'Income', 'Grants', 'Government Grant', 'Organization', 'Legality Library', 100000.00, 'N'),
('2024-12-01', 'Income', 'Donations', 'Donor B', 'Foundation', 'Deposit Bathroom', 15000.00, 'N'),
('2024-12-05', 'Income', 'Other Income', 'Fundraising Event', 'Foundation', 'Painting Fabrication', 30000.00, 'N'),

-- Expense transactions - various subcategories (Organization pays vendors/suppliers)
('2024-11-10', 'Expense', 'Salaries', 'Organization', 'Staff Member 1', 'Monthly Salary', 20000.00, 'N'),
('2024-11-12', 'Expense', 'Utilities', 'Organization', 'Electricity Company', 'Bathroom Cleaning Plumbing', 5000.00, 'N'),
('2024-11-18', 'Expense', 'Books & Materials', 'Foundation', 'Book Supplier', 'Library', 12000.00, 'N'),
('2024-11-22', 'Expense', 'Infrastructure', 'Organization', 'Construction Company', 'Classroom', 75000.00, 'N'),
('2024-11-28', 'Expense', 'Salaries', 'Foundation', 'Staff Member 2', 'Monthly Salary', 18000.00, 'N'),
('2024-12-03', 'Expense', 'Utilities', 'Organization', 'Water Department', 'Rent', 3000.00, 'N'),
('2024-12-07', 'Expense', 'Other Expenses', 'Foundation', 'Maintenance Service', 'Cleaning', 8000.00, 'N'),
('2024-12-10', 'Expense', 'Books & Materials', 'Organization', 'Stationery Shop', 'Painting', 4500.00, 'N'),
('2024-12-12', 'Expense', 'Infrastructure', 'Foundation', 'Renovation Co', 'Fabrication', 55000.00, 'N'),

-- Edge cases: Large amounts, small amounts
('2024-10-05', 'Income', 'Donations', 'Major Donor', 'Organization', 'Deposit Legality', 500000.00, 'N'),
('2024-10-10', 'Income', 'Student Fees', 'Fee Collection', 'Foundation', 'Rent', 100.00, 'N'),
('2024-10-15', 'Expense', 'Salaries', 'Organization', 'Senior Staff', 'Monthly Salary', 45000.00, 'N'),
('2024-10-20', 'Expense', 'Utilities', 'Foundation', 'Internet Provider', 'Library', 2500.00, 'N'),

-- Various date ranges for testing filters
('2024-09-01', 'Income', 'Grants', 'NGO Grant', 'Organization', 'Deposit', 75000.00, 'N'),
('2024-09-10', 'Expense', 'Infrastructure', 'Organization', 'Contractor', 'Classroom Bathroom', 125000.00, 'N'),
('2024-09-15', 'Income', 'Donations', 'Anonymous Donor', 'Foundation', 'Legality', 25000.00, 'N'),
('2024-09-20', 'Expense', 'Books & Materials', 'Organization', 'Publisher', 'Library', 15000.00, 'N'),

-- More variety in remarks and combinations
('2024-12-15', 'Income', 'Student Fees', 'Batch 2024', 'Organization', 'Painting Fabrication Cleaning', 35000.00, 'N'),
('2024-12-18', 'Expense', 'Other Expenses', 'Foundation', 'Security Service', 'Rent', 12000.00, 'N'),
('2024-12-20', 'Income', 'Grants', 'Corporate Grant', 'Organization', 'Deposit Classroom', 200000.00, 'N'),
('2024-12-22', 'Expense', 'Utilities', 'Organization', 'Gas Company', 'Bathroom Plumbing', 4500.00, 'N'),
('2024-12-25', 'Income', 'Donations', 'Community Fund', 'Foundation', 'Library Legality', 60000.00, 'N'),
('2024-12-28', 'Expense', 'Infrastructure', 'Organization', 'Architect', 'Classroom', 95000.00, 'N'),

-- Testing different quarters and fiscal year (FY 2023-2024: Apr 2023 - Mar 2024)
('2023-04-01', 'Income', 'Donations', 'Fiscal Year Start', 'Organization', 'Deposit', 100000.00, 'N'),
('2023-07-15', 'Expense', 'Infrastructure', 'Foundation', 'Builder', 'Painting', 80000.00, 'N'),
('2023-10-20', 'Income', 'Grants', 'Q3 Grant', 'Organization', 'Fabrication', 150000.00, 'N'),
('2024-03-30', 'Expense', 'Other Expenses', 'Organization', 'Year End', 'Cleaning', 5000.00, 'N');



