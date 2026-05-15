# Academic Task Plan

## What This File Covers

This file is a step-by-step guide for the remaining academic work in [DBLab_ProjectUpdate.pdf](DBLab_ProjectUpdate.pdf).

Module 1 is already completed through the ERD deliverable:
- [ERD_Documentation.pdf](ERD_Documentation.pdf)
- [academic-erd-simplified.md](academic-erd-simplified.md)

The PDF then continues with Milestones 2, 3, 4, and 5 in order. This plan follows that sequence directly.

## Important Database Note

The PDF mentions MySQL and MySQL Workbench, but the Broady project is already built on PostgreSQL + Prisma.

Use PostgreSQL for the actual implementation because:
- the current project stack already uses PostgreSQL
- the ERD and relationships are database-agnostic at the academic level
- rewriting the database layer only to match the PDF wording would add unnecessary work

If you need to explain this to your instructor, use this wording:

> “The assignment uses MySQL language, but I implemented the database in PostgreSQL because the existing project is already built with PostgreSQL and Prisma. The ERD, normalization, keys, relationships, and validation steps remain the same.”

## New Repository Strategy

Do not keep the academic submission inside the main Broady workspace.

Recommended workflow:

1. Create a new Git repository for the academic task.
2. Clone that repository into a clean folder.
3. Create a separate academic project folder inside it.
4. Keep the academic work isolated from Broady.
5. Commit each milestone separately.

Recommended structure:

```text
academic-project/
├── docs/
├── prisma/
├── csv/
├── sql/
├── src/
└── README.md
```

## Current Status

Completed:
- Module 1 / ERD documentation

Remaining:
- Milestone 2
- Milestone 3
- Milestone 4
- Milestone 5

## Milestone 2 - ERD Design and Normalization

This milestone is the first remaining step in the PDF.

### Step 1: Apply Normalization

Review every table in the schema and document the progression through:
- 1NF
- 2NF
- 3NF

For each normal form, write:
- what the issue was
- what change you made
- why the change was needed

If a table already satisfies the normal form, still write a short justification.

### Step 2: Remove Duplicates

Check for:
- redundant columns
- repeated data
- overlapping attributes

Remove or restructure anything unnecessary, then document the change.

### Step 3: Update the ERD

Reflect the normalized design in the ERD:
- primary keys
- foreign keys
- relationships
- cardinalities

Make sure the final ERD matches the normalized schema.

### Step 4: Commit to GitHub

Add a normalization document to the repository as either:
- `NORMALIZATION.md`
- or a normalization section in `README.md`

Commit the updated ERD with a clear message such as:
- `M2: Applied 2NF and 3NF normalization, updated ERD and schema`

### Milestone 2 Deliverables

- normalization write-up
- updated ERD diagram
- updated schema notes
- GitHub commit for Milestone 2

## Milestone 3 - Dataset Preprocessing

### Step 1: Prepare the Dataset

If using real data, clean it:
- remove duplicates
- fix formatting issues
- handle null values
- keep data types consistent

If using dummy data, generate structured synthetic data:
- realistic
- meaningful
- enough to populate the database

Target volume:
- at least 50 to 100 rows per table

### Step 2: Define the Dataflow

Write a project-specific Dataflow section that explains:
- where data enters the system
- how it moves through the database
- which tables depend on others
- what comes out of the system

Do not use a generic template. Make it specific to the academic project.

### Step 3: Export Clean CSV Files

Export the prepared data as CSV files:
- one CSV per table

These files will be used later in Milestone 5.

### Step 4: Commit to GitHub

Push the cleaned or synthetic CSV files and the dataflow description.

Suggested commit message:
- `M3: Synthetic data generated; dataflow documented`

### Milestone 3 Deliverables

- cleaned or synthetic CSV files
- dataflow documentation
- GitHub commit for Milestone 3

## Milestone 4 - Database Setup (DDL)

### Step 1: Write CREATE TABLE Statements

Create DDL scripts based on the finalized normalized schema.

Every table should include:
- primary key
- required foreign keys
- NOT NULL where needed
- UNIQUE constraints where needed
- CHECK constraints where needed

### Step 2: Add Indexes

Add indexes for:
- foreign key columns
- frequently queried columns

### Step 3: Verify the Schema

The PDF says to verify the schema in MySQL Workbench and confirm the EER diagram matches the DDL.

For this project, keep the same academic intent but implement it in PostgreSQL. You can verify the equivalent schema consistency using PostgreSQL tooling and the Prisma schema.

### Step 4: Commit to GitHub

Commit the DDL scripts with a message like:
- `M4: DDL scripts added, EER diagram verified`

### Milestone 4 Deliverables

- SQL DDL scripts
- updated schema evidence
- GitHub commit for Milestone 4

## Milestone 5 - Data Population (DML)

### Step 1: Load the Data

Load the CSV or insert the data using:
- `LOAD DATA INFILE`, or
- `INSERT` statements

Use the PostgreSQL equivalent approach in the implementation.

### Step 2: Demonstrate UPDATE and DELETE

Include at least:
- one `UPDATE` with a `WHERE` clause
- one `DELETE` with a `WHERE` clause

### Step 3: Run Validation Queries

Include evidence for:
- `COUNT(*)` for each table
- `NULL` checks on key columns
- `JOIN` checks to confirm foreign key integrity

### Step 4: Commit to GitHub

Commit the DML scripts and validation output.

Suggested commit message:
- `M5: Data populated validation queries added`

### Milestone 5 Deliverables

- DML scripts
- validation query output
- row count checks
- GitHub commit for Milestone 5

## Submission Requirements

The PDF requires both of these:

### 1. GitHub Repository

The repository should contain:
- updated ERD diagram
- normalization document with 1NF to 3NF justifications
- dataflow description
- cleaned or synthetic CSV files
- DDL scripts
- DML scripts with validation outputs
- clear commit history with at least one commit per milestone

### 2. PDF Upload

Submit one final PDF containing:
- group name and both member names
- updated ERD diagram
- normalization walkthrough
- dataflow description
- GitHub repository link

Filename format:
- `GroupName_Version_Control_DBLab.pdf`

## Suggested Order Of Work

1. Finish normalization documentation for Milestone 2.
2. Update the ERD to reflect normalization.
3. Generate and clean dataset files for Milestone 3.
4. Write the dataflow description.
5. Write DDL scripts for Milestone 4.
6. Load data and run validation for Milestone 5.
7. Prepare the final PDF submission.

## What To Reuse From Broady

The Broady project is useful as a reference for:
- PostgreSQL + Prisma structure
- relational entity design
- category normalization
- order and sub-order relationships
- branded marketplace relationships

Keep the academic repo smaller than the production project and focus on the milestone requirements only.

## Presentation Notes

When explaining the work, follow the same order as the PDF:

1. ERD and normalization
2. dataset preprocessing and dataflow
3. DDL setup
4. data population
5. validation evidence
6. final repository and PDF submission

## Final Reminder

Yes, the PDF is a step-by-step guide from Milestone 2 onward.

This markdown file should be used as your working checklist while you build the separate academic repository.