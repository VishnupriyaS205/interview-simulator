INSERT INTO fields (name) VALUES
('Frontend Developer'),
('Backend Developer'),
('Full Stack Developer'),
('Data Analytics'),
('Product');

INSERT INTO rounds (name) VALUES
('Aptitude'),
('Maths'),
('Logical Reasoning'),
('English'),
('Technical Round'),
('AI Interview Analysis');

INSERT INTO questions (field_id, round_id, question_text) VALUES
(1, 5, 'What is the difference between HTML, CSS, and JavaScript?'),
(2, 5, 'What is an API?'),
(4, 5, 'What is the difference between rows and columns in a dataset?'),
(5, 4, 'Introduce yourself in simple English.'),
(1, 2, 'If a webpage loads in 4 seconds and optimization reduces time by 25%, what is the new load time?');
