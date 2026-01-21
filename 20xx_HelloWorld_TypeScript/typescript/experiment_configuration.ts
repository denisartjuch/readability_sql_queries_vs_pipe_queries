// experiment_configuration MAIN EXPERIMENT

import { BROWSER_EXPERIMENT } from "../N-of-1-Experimentation/modules/Experimentation/Browser_Output_Writer";
import {
    Experiment_Output_Writer,
    Time_to_finish,
    text_input_experiment,
    SET_SEED,
    alternatives,
} from "../N-of-1-Experimentation/modules/Experimentation/Experimentation";
import { Task } from "../N-of-1-Experimentation/modules/Experimentation/Task";

import { formatted, Row } from "../queries100RepsMainExperiment.js";
import { random_array_element } from "../N-of-1-Experimentation/modules/Experimentation/Experimentation.js";

let SEED = "42";
SET_SEED(SEED);

let results: Row[] = formatted

let experiment_configuration_function = (writer: Experiment_Output_Writer) => {
    return {
        experiment_name: "CTE vs. Pipe",
        seed: SEED,

        introduction_pages: [
            () => {
                writer.print_string_on_stage(`
          <section class="instructions" lang="en">
            <h1>Experiment Instructions</h1>

            <p>
              Please only start the experiment if you have sufficient time
              (<strong>approximately 20–35 minutes</strong>), are able to focus, and feel motivated to complete it in one go.
            </p>

            <h2>Technical Setup</h2>
            <ul>
              <li>Use a device with a screen resolution of at least <strong>1920×1080</strong>.</li>
<li>
  Once the experiment opens, switch your browser to <strong>full-screen mode</strong>
  (on many systems this is <span class="sourcecode">F11</span>).
 <li>Zoom out (Ctrl/⌘ + –) until the entire query is visible <strong>without scrolling</strong>.</li>

</li>
            </ul>

<h2>Your Task</h2>
<p>
  In each trial, you will be shown <strong>one SQL query</strong> written in one of two syntaxes:
</p>
<ul>
  <li><strong>Standard SQL syntax</strong> (using CTEs), or</li>
  <li><strong>Pipe-based SQL syntax</strong></li>
</ul>


            <p>
              For <strong>each</strong> query, decide whether it contains a <strong>syntactic error</strong>.
              If it does, enter the <strong>line number</strong> where the error occurs (or where you first notice it).
              If there is <strong>no error</strong>, enter <strong>0</strong> and press <strong>Enter</strong>.
            </p>

            <p>
              Each query contains <strong>at most one</strong> error (or none).
            </p>

            <h2>How to Respond</h2>
            <ul>
              <li>If there is an error: enter the <strong>line number</strong> where it occurs.</li>
              <li>If there is no error: enter <strong>0</strong> and press <strong>Enter</strong>.</li>
            </ul>

            <h2>Explanation of Google's Pipe Syntax and Revision of Common SQL Syntax</h2>
            <p>
              Please review the next pages (press the right arrow → to navigate) and <strong>read through</strong> explanation for google's pipe syntax and revision of common SQL syntax.
            </p>


            <h2>Error Types</h2>
            <p>
              Please review the next pages (press the right arrow → to navigate) and <strong>read through</strong> the error types.
              Then, in the training phase, you can practice for the experiment and confirm whether you’ve understood the error types.
            </p>

            <h4>Thank you for your careful participation.</h4>

          </section>
        `);
            },

            () => {
                writer.print_string_on_stage(`<h2>Google Pipe Syntax</h2>

<p>
  Google <strong>Pipe Syntax</strong> expresses a query as a <strong>linear data flow</strong>:
  you start with a source (<span class="sourcecode">FROM</span>) and then pass the intermediate
  result through transformation stages using <span class="sourcecode">|&gt;</span>.
</p>

<p>
  Each stage consumes the table produced by the previous stage and outputs a new table.
</p>

<p>
  <strong>Important for this experiment:</strong> the special property of Pipe Syntax is this
  <strong>explicit linear data flow</strong> (a sequence of stages). The experiment deliberately
  relies on this idea and compares Pipe Syntax to <strong>CTE-based SQL</strong>, because
  <strong>both</strong> can be written to enforce the same step-by-step linear flow.
</p>

<p>
  The most common stages are:
  <span class="sourcecode">|&gt; SELECT</span> (shape the data by choosing/renaming columns and deriving new fields),
  <span class="sourcecode">GROUP BY</span> (bucket rows into groups),
  and <span class="sourcecode">|&gt; AGGREGATE</span> (compute summaries like
  <span class="sourcecode">COUNT</span>, <span class="sourcecode">SUM</span>, and <span class="sourcecode">AVG</span>
  for each group).
  The key principle: every stage does one clear step, and the output flows forward to the next stage.
</p>
<p>
  When combining projection with aggregation, the <span class="sourcecode">|&gt; SELECT</span> stage is omitted entirely.
  The <span class="sourcecode">GROUP BY</span> clause handles both grouping and projection: columns listed in
  <span class="sourcecode">GROUP BY</span> automatically appear in the output alongside the aggregated values.
</p>

<h3>Pipe example 1: <span class="sourcecode">|&gt; SELECT</span> (projection)</h3>

<pre class="sourcecode"><code>-- Start: read the base table
-- Visible columns: all columns from base
FROM base

-- Project fields (this defines the new "shape" of the table)
-- Visible columns after this step: customer_id, order_id, order_total
|&gt; SELECT
     customer_id,
     order_id,
     order_total
-- Re-project to keep only what you need
-- Visible columns after this step: customer_id, order_total
|&gt; SELECT
     customer_id,
     order_total;</code></pre>

<h3>Pipe example 2: <span class="sourcecode">GROUP BY</span> + <span class="sourcecode">|&gt; AGGREGATE</span></h3>

<pre class="sourcecode"><code>-- Start: read the base table
-- Visible columns: all columns from base
FROM base

-- Prepare the fields needed for grouping + aggregations
-- Visible columns after this step: customer_id, order_total, order_date
|&gt; SELECT
     customer_id,
     order_total,
     order_date

-- Aggregate collapses rows into one row per group
-- GROUP BY keys remain visible; aggregate outputs become new columns
-- Visible columns after this step: revenue, avg_order_value, customer_id, order_date
|&gt; AGGREGATE
     SUM(order_total) AS revenue,
     AVG(order_total) AS avg_order_value
   GROUP BY 
     customer_id, 
     order_date

-- Final projection, keeps the result tidy
-- Visible columns after this step: customer_id, order_date, revenue, avg_order_value
|&gt; SELECT
     customer_id,
     order_date,
     revenue,
     avg_order_value;</code></pre>
`);
            },

        
            () => {
                writer.print_string_on_stage(`<h2>Pipe example 3: Aggregation (and GROUP BY) with sample table</h2>
<p>
  This example uses aggregation: we group by <span class="sourcecode">city</span>,
  count people, and compute the average age.
</p>
<h3>Sample table: <span class="sourcecode">people</span></h3>
<p>Columns:</p>
<ul>
  <li><span class="sourcecode">id</span> (INT)</li>
  <li><span class="sourcecode">name</span> (STRING)</li>
  <li><span class="sourcecode">city</span> (STRING)</li>
  <li><span class="sourcecode">age</span> (INT)</li>
</ul>
<p>Sample data:</p>
<pre class="sourcecode"><code>-- people
-- id | name  | city    | age
1     | Anna  | Berlin  | 28
2     | Ben   | Berlin  | 17
3     | Carla | Munich  | 34
4     | Diego | Berlin  | 42
5     | Emma  | Hamburg | 22</code></pre>
<h3>Pipe query: people per city</h3>
<pre class="sourcecode"><code>-- Start: read the base table
-- Visible columns: all columns from people
FROM people

-- Aggregate into one row per city
-- No |&gt; SELECT needed: GROUP BY keys + aggregate results are projected automatically
-- Visible columns after this step: city, residents, avg_age
|&gt; AGGREGATE
     COUNT(*) AS residents,
     AVG(age) AS avg_age
   GROUP BY 
     city;</code></pre>

<h3>Expected result</h3>
<pre class="sourcecode"><code> city    | residents | avg_age
Berlin     | 3         | 29.0
Munich     | 1         | 34.0
Hamburg    | 1         | 22.0</code></pre>
`);
            },


            () => {
                writer.print_string_on_stage(`<h2>Standard SQL with CTEs</h2>

<p>
  In <strong>standard SQL</strong>, the same step-by-step “pipeline” is typically written using
  <strong>CTEs</strong> (<span class="sourcecode">WITH ... AS (...)</span>).
  Each CTE represents one stage: it produces a temporary result table, and the next CTEs can read from it.
  This can create the same <strong>linear data flow</strong> as Pipe Syntax.
</p>

<p>
  Important mental model: a CTE defines the <strong>visible/accessible columns</strong> for later steps.
  If a column is not selected into a CTE (or produced by aggregation), it cannot be referenced downstream.
</p>

<h3>SQL example 1: Projection + Aggregation</h3>

<pre class="sourcecode"><code>-- Start: read the base table
-- Visible columns: all columns from base
WITH step_0 AS (
  SELECT
     customer_id,
     order_id,
     order_total,
     SUM(order_ts) AS yearly_orders_ts
   FROM base
   GROUP BY
     customer_id, 
     order_id, 
     order_total
  -- Visible columns after step_0: customer_id, order_id, order_total, yearly_orders_ts
),
step_1 AS (
  SELECT
    customer_id,
    yearly_orders_ts,
    order_total
  FROM step_0
  -- Visible columns after step_1: customer_id, yearly_orders_ts, order_total
)
SELECT *
FROM step_1;</code></pre>

<h3>SQL example 2: GROUP BY + aggregates</h3>

<pre class="sourcecode"><code>-- Start: read the base table
-- Visible columns: all columns from base
WITH step_0 AS (
  SELECT
    customer_id,
    order_total,
    order_date
  FROM base
  -- Visible columns after step_0: customer_id, order_total, order_date
),
step_1 AS (
  SELECT
    customer_id,
    order_date,
    SUM(order_total) AS revenue,
    AVG(order_total) AS avg_order_value
  FROM step_0
  GROUP BY 
    customer_id, 
    order_date
  -- Visible columns after step_1: customer_id, order_date, revenue, avg_order_value
),
step_2 AS (
  SELECT
    customer_id,
    order_date,
    revenue,
    avg_order_value
  FROM step_1
  -- Visible columns after step_2: customer_id, order_date, revenue, avg_order_value
)
SELECT *
FROM step_2;</code></pre>
`);
            },

            () => {
                writer.print_string_on_stage(`<h2>SQL example 3: Aggregation + GROUP BY</h2>

<p>
  Same logic as the pipe version, but written as plain SQL using CTEs:
  group by <span class="sourcecode">city</span>, count people, compute average age.
</p>

<h3>Sample table: <span class="sourcecode">people</span></h3>

<p>Columns:</p>
<ul>
  <li><span class="sourcecode">id</span> (INT)</li>
  <li><span class="sourcecode">name</span> (STRING)</li>
  <li><span class="sourcecode">city</span> (STRING)</li>
  <li><span class="sourcecode">age</span> (INT)</li>
</ul>

<p>Sample data:</p>
<pre class="sourcecode"><code>-- people
-- id | name  | city    | age
1     | Anna  | Berlin  | 28
2     | Ben   | Berlin  | 17
3     | Carla | Munich  | 34
4     | Diego | Berlin  | 42
5     | Emma  | Hamburg | 22</code></pre>

<h3>SQL query (CTEs)</h3>

<pre class="sourcecode"><code>WITH step_0 AS (
  -- Start: read the base table
  SELECT *
  FROM people
),
step_1 AS (
  -- Aggregate into one row per city
  SELECT
    city,
    COUNT(*) AS residents,
    AVG(age) AS avg_age
  FROM step_0
  GROUP BY 
    city
)
-- Final projection
SELECT
  city,
  residents,
  avg_age
FROM step_1;</code></pre>

<h3>Expected result</h3>
<pre class="sourcecode"><code>-- city    | residents | avg_age
Berlin     | 3         | 29.0
Munich     | 1         | 34.0
Hamburg    | 1         | 22.0</code></pre>
`);
            },


            () => {
                writer.print_string_on_stage(`
<h3>Mini example: Multi-stage aggregation</h3>

<div style="display:flex; gap:14px; align-items:flex-start; width:100%;">
  <div style="flex:1 1 50%; min-width:0;">
    <h4>Pipe Syntax</h4>
    <pre class="sourcecode"><code>FROM Base
|&gt; AGGREGATE
     SUM(amount) AS month_amount
   GROUP BY
     customer_id
|&gt; AGGREGATE
     SUM(month_amount) AS ytd_amount,
     MAX(month_amount) AS best_month_amount
   GROUP BY
     customer_id;</code></pre>
  </div>

  <div style="flex:1 1 50%; min-width:0;">
    <h4>Standard SQL with CTEs</h4>
    <pre class="sourcecode"><code>WITH step_0 AS (
  SELECT *
  FROM Base
),
step_1 AS (
  SELECT
    customer_id,
    SUM(amount) AS month_amount
  FROM step_0
  GROUP BY
    customer_id
),
step_2 AS (
  SELECT
    customer_id,
    SUM(month_amount) AS ytd_amount,
    MAX(month_amount) AS best_month_amount
  FROM step_1
  GROUP BY 
    customer_id
)
SELECT *
FROM step_2;
</code></pre>
  </div>
</div>


<p>
  <strong>What you should watch for in the experiment:</strong> if a column is not introduced (projected/aggregated)
  in an earlier step, it cannot be referenced later, this is exactly what many of the syntactic error types test.
</p>
`);
            },
            () => {
                writer.print_string_on_stage(`
<h3>Mini example 2</h3>
<div style="display:flex; gap:14px; align-items:flex-start; width:100%;">
  <div style="flex:1 1 50%; min-width:0;">
    <h4>Pipe Syntax</h4>
    <pre class="sourcecode"><code>FROM transactions
|&gt; AGGREGATE
     SUM(revenue) AS revenue_daily,
     COUNT(*) AS num_transactions
   GROUP BY
     store_id,
     tx_date
|&gt; SELECT
     store_id,
     tx_date,
     revenue_daily
|&gt; AGGREGATE
     SUM(revenue_daily) AS revenue_monthly,
     AVG(revenue_daily) AS avg_daily_revenue
   GROUP BY
     store_id
|&gt; SELECT
     store_id,
     revenue_monthly
|&gt; AGGREGATE
     SUM(revenue_monthly) AS revenue_yearly
   GROUP BY
     store_id;</code></pre>
  </div>
  <div style="flex:1 1 50%; min-width:0;">
    <h4>Standard SQL with CTEs</h4>
    <pre class="sourcecode"><code>WITH step_0 AS (
  SELECT
    store_id,
    tx_date,
    SUM(revenue) AS revenue_daily,
    COUNT(*) AS num_transactions
  FROM base
  GROUP BY 
    store_id, 
    tx_date
),
step_1 AS (
  SELECT
    store_id,
    tx_date,
    revenue_daily
  FROM step_0
),
step_2 AS (
  SELECT
    store_id,
    SUM(revenue_daily) AS revenue_monthly,
    AVG(revenue_daily) AS avg_daily_revenue
  FROM step_1
  GROUP BY 
    store_id
),
step_3 AS (
  SELECT
    store_id,
    revenue_monthly
  FROM step_2
),
step_4 AS (
  SELECT
    store_id,
    SUM(revenue_monthly) AS revenue_yearly
  FROM step_3
  GROUP BY store_id
)
SELECT *
FROM step_4;</code></pre>
  </div>
</div>
<p>
  <strong>Notice:</strong> The intermediate <span class="sourcecode">|&gt; SELECT</span> steps drop columns 
  (<span class="sourcecode">num_transactions</span>, <span class="sourcecode">avg_daily_revenue</span>) 
  before the next aggregation. Referencing a dropped column in later steps would cause a syntax error.
</p>
`);
            },

            () => {
                writer.print_string_on_stage(`<h2>Possible Error Types</h2>
<h3>Error Type 1: New column appears in SELECT</h3>
<p>
  A column is projected in the <strong>SELECT</strong> clause even though it has not been projected, aggregated or grouped in an earlier step.
  This means the column appears for the first time in <strong>SELECT</strong>.
</p>
<p>
  <strong>Only occurs in:</strong>
  <span class="sourcecode">SELECT</span> / <span class="sourcecode">|&gt; SELECT</span>.
</p>
<h4>Pipe example</h4>
<pre class="sourcecode"><code>FROM base
|&gt; SELECT
     sponge,
     trees
|&gt; SELECT
     sponge,
     trees,
     crown   -- ❌ Error Type 1: "crown" was not projected in the previous step
|&gt; SELECT *;</code></pre>

<h4>Standard SQL example</h4>
<pre class="sourcecode"><code>WITH CTE_0 AS (
  SELECT
    sponge,
    trees
  FROM base
),
CTE_1 AS (
  SELECT
    sponge,
    trees,
    crown   -- ❌ Error Type 1: "crown" was not projected in the previous step
  FROM CTE_0
)
SELECT *
FROM CTE_1;</code></pre>
`);
            },

            () => {
                writer.print_string_on_stage(`<h2>Possible Error Types</h2>
<h3>Error Type 2: Invalid column in GROUP BY</h3>
<p>
  A column appears in <span class="sourcecode">GROUP BY</span> even though it has not been 
  projected or grouped in an earlier step.
</p>
<p>
  <strong>Only occurs in:</strong> <span class="sourcecode">GROUP BY</span>.
</p>

<h4>Pipe example</h4>
<pre class="sourcecode"><code>FROM base
|&gt; SELECT
     sponge,
     expert
|&gt; AGGREGATE
     AVG(expert) AS avg_expert
   GROUP BY
     sponge,
     crown   -- ❌ Error Type 2: "crown" was not projected in the previous step
|&gt; SELECT *;</code></pre>

<h4>Standard SQL example</h4>
<pre class="sourcecode"><code>WITH step_0 AS (
  SELECT
    sponge,
    expert
  FROM base
),
step_1 AS (
  SELECT
    sponge,
    AVG(expert) AS avg_expert
  FROM step_0
  GROUP BY
    sponge,
    crown   -- ❌ Error Type 2: "crown" was not projected in the previous step
)
SELECT *
FROM step_1;</code></pre>`);
            },

            () => {
                writer.print_string_on_stage(`<h2>Possible Error Types</h2>
<h3>Error Type 3: Aggregate uses an unknown column</h3>
<p>
  An aggregate function references a column that has not been projected or grouped in an earlier step.
</p>
<p>
  <strong>Only occurs in:</strong>
  <span class="sourcecode">COUNT(COL), AVG(COL), MIN(COL), MAX(COL), SUM(COL)</span>.
</p>

<h4>Pipe example</h4>
<pre class="sourcecode"><code>FROM base
|&gt; SELECT
     sponge,
     expert
|&gt; AGGREGATE
     AVG(expert) AS avg_expert,
     SUM(crown)  AS sum_crown   -- ❌ Error Type 3: "crown" is unknown and can not be aggregated
   GROUP BY
     sponge
|&gt; SELECT *;</code></pre>

<h4>Standard SQL example</h4>
<pre class="sourcecode"><code>WITH step_0 AS (
  SELECT
    sponge,
    expert
  FROM base
),
step_1 AS (
  SELECT
    sponge,
    AVG(expert) AS avg_expert,
    SUM(crown)  AS sum_crown   -- ❌ Error Type 3: "crown" is unknown in step_1 and can not be aggregated
  FROM step_0
  GROUP BY 
    sponge
)
SELECT *
FROM step_1;</code></pre>`);
            },
        ],

        pre_run_training_instructions: writer.string_page_command(
            writer.convert_string_to_html_string(
                "You have entered the training phase. It consists of 9 example queries per syntax.\n\nFor each query, decide whether it contains a syntactic error:\n- If an error is present, enter the line number where the error occurs (or where you first notice it).\n- If there is no error, press 0 and [ENTER] to continue.\n\nYou will advance to the next task after you enter your answer."
            )
        ),

        pre_run_experiment_instructions: writer.string_page_command(
            writer.convert_string_to_html_string(
                "You entered the experiment phase. It should take probably 15-30 minutes until the end of experiment."
            )
        ),

        post_questionnaire: [
            alternatives("Age", "What's your age??", [
                "younger than 18",
                "between 18 and (excluding) 25",
                "between 25 and (excluding) 30",
                "between 30 and (excluding) 35",
                "between 35 and (excluding) 40",
                "between 40 and (excluding) 45",
                "45 or older",
            ]),

            alternatives("Status", "What is your current working status?", [
                "Undergraduate student (BSc not yet finished)",
                "Graduate student (at least BSc finished)",
                "PhD student",
                "Employed in software/data industry (Software developer, Data Scientist, Data Engineer, ...)",
                "Other",
            ]),

            alternatives("Studies", "In case you study, what's your subject?", [
                "I do not study",
                "Computer science",
                "computer science related (such as information systems, aka WiInf)",
                "something else in natural sciences",
                "something else",
            ]),

            alternatives("LOCExperienceProgramming", "What describes your programming background best?", [
                "I never program",
                "I rarely program",
                "I write some LOC from time to time",
                "I frequently write code",
                "I write code almost every day",
            ]),

            alternatives("LOCExperienceSQL", "What describes your SQL background best?", [
                "I never write SQL queries",
                "I rarely SQL queries",
                "I write some SQL queries from time to time",
                "I frequently SQL queries",
                "I write SQL queries almost every day",
            ]),

            alternatives("YearsOfExperienceSoftware", "How many years of experience do you have in software industry?", [
                "none",
                "less than or equal 1 year",
                "more than 1 year, but less than or equal 3 years",
                "more than 3 years, but less than or equal 5 year",
                "more than 5 years",
            ]),

            alternatives("YearsOfExperienceData", "How many years of experience do you have in Data industry?", [
                "none",
                "less than or equal 1 year",
                "more than 1 year, but less than or equal 3 years",
                "more than 3 years, but less than or equal 5 year",
                "more than 5 years",
            ]),

            alternatives("impression", "Which statement best describes your overall impression of the experiment?", [
                "I did not notice a difference between standard SQL syntax and pipe-based SQL syntax.",
                "Pipe-based SQL syntax made it slightly easier for me than standard SQL syntax.",
                "Pipe-based SQL syntax made it much easier for me than standard SQL syntax.",
                "Standard SQL syntax made it slightly easier for me than pipe-based SQL syntax.",
                "Standard SQL syntax made it much easier for me than pipe-based SQL syntax.",
            ]),

            alternatives("preference", "Which SQL syntax did you find more appealing?", [
                "Slightly prefer pipe-based SQL syntax over standard SQL syntax.",
                "Slightly prefer standard SQL syntax over pipe-based SQL syntax.",
                "Strongly prefer pipe-based SQL syntax over standard SQL syntax.",
                "Strongly prefer standard SQL syntax over pipe-based SQL syntax.",
                "No preference / I don't mind which SQL syntax is used.",
            ]),
        ],

        finish_pages: [
            writer.string_page_command(
                "<p>Almost done. Next, the experiment data will be downloaded (after pressing [Enter]).<br><br>" +
                "Please, send the " +
                "downloaded file to the experimenter: " +
                "<a href='mailto:denis.artjuch@stud.uni-due.de'>denis.artjuch@stud.uni-due.de</a></p>" +
                "<p>By sending that mail, you agree that " +
                "your (anonymized) data will be used for scientific analyses where your data (together with others in an " +
                "anonymized way) will be published.<br><br>I.e., you agree with the information sheet, see " +
                "<a href='https://github.com/denisartjuch/readability_sql_queries_vs_pipe_queries/blob/main/Agreement.pdf' target='_blank'>here</a>. " +
                "Note, that it it no longer necessary to send a signed version of the agreement to the experimenter.<br><br>" +
                "After sending your email, you can close this window.</p>" +
                "<p>Many thanks for your participation.<br>" +
                "-Denis Artjuch</p>"
            ),
        ],

        layout: [
            { variable: "queryKind", treatments: ["sql", "pipe"] },
            //{ variable: "errorType", treatments: ["SELECT_UNKNOWN", "AGG_UNKNOWN", "GROUP_UNKNOWN"] },
            { variable: "totalInformationDifference", treatments: ["0", "4", "8"] },
        ],

        repetitions: 12,
        measurement: Time_to_finish(text_input_experiment), 

        training_configuration: {
            fixed_treatments: [
                ["sql","0"],
                ["sql", "4"],
                ["sql","8"],
                ["pipe","0"],
                ["pipe","4"],
                ["pipe", "8"],
                ["sql", "0"],
                ["sql", "4"],
                ["sql", "8"],
                ["pipe", "0"],
                ["pipe", "4"],
                ["pipe", "8"],
                ["sql", "0"],
                ["sql", "4"],
                ["sql", "8"],
                ["pipe", "0"],
                ["pipe", "4"],
                ["pipe", "8"],
            ],
            can_be_cancelled: false,
            can_be_repeated: false,
        },

        task_configuration: (t: Task) => {
            const current_queryKind = t.treatment_value("queryKind");
            const current_InformationDifference = Number(t.treatment_value("totalInformationDifference"));

            const task: Row = random_array_element(results.filter((entry) =>
                entry.totalInformationDifference === current_InformationDifference
                ));

            const queryText = current_queryKind === "pipe" ? (task as any).pipeQuery : task.sqlQuery;

            const queryWithLineNumbers = queryText
                .split("\n")
                .map((line: string, index: number) => {
                    const lineNumber = index + 1;
                    const lineNumberStr = lineNumber.toString().padStart(3, " ");
                    return `${lineNumberStr} | ${line}`;
                })
                .join("\n");

            const queryHtml = "<pre><code>" + writer.convert_string_to_html_string(queryWithLineNumbers) + "</code></pre>";

            const renderTwoColumn = (leftHtml: string, rightHtml: string) => `
        <div style="
          display:flex;
          gap:14px;
          align-items:flex-start;
          width:100%;
        ">
          <div style="flex:1 1 70%; min-width:0;">
            ${leftHtml}
          </div>

          <aside style="
            flex:0 0 30%;
            max-width:30%;
            min-width:260px;
            border-left:1px solid rgba(0,0,0,0.12);
            padding-left:10px;
            padding-right:6px;
            text-align:left;
          ">
            <div style="text-align:left;">
              ${rightHtml}
            </div>
          </aside>
        </div>
      `;

            t.do_print_task = () => {
                writer.clear_stage();

                const rightPlaceholder = `
          <div style="
            opacity:0.65;
            font-size:0.95em;
            line-height:1.35;
          ">
            Feedback will appear here after you answer.
          </div>
        `;

                writer.print_html_on_stage(renderTwoColumn(queryHtml, rightPlaceholder));
            };

            t.expected_answer = JSON.stringify(current_queryKind === "pipe" ? task.errorLinePipe : task.errorLineSQL);

            t.do_print_after_task_information = () => {
                writer.clear_stage();
                writer.clear_error?.();

                const correctAnswer = current_queryKind === "pipe" ? task.errorLinePipe : task.errorLineSQL;
                const attribuetsUntilError =
                    current_queryKind === "pipe" ? task.totalInformationUntilErrorPipe : task.totalInformationUntilErrorSQL;

                const correctAnswerText = correctAnswer === null ? "There was no Error" : String(correctAnswer);

                const wrongAttribute = task.unknownName === null ? "There was no Error" : task.unknownName;

                const generalHint =
                    "In case your answer was wrong:\n" +
                    "- Refer to the prior CTE/stage where the column should have been introduced.\n" +
                    "- Validate that the column has been projected or aggregated before it is referenced.";

                const feedbackHtml = `
          <div style="font-size:0.98em; line-height:1.45;">
            <p style="margin:0 0 10px 0;"><strong>The correct answer was:</strong> ${writer.convert_string_to_html_string(
                    correctAnswerText
                )}</p>

            <p style="margin:0 0 16px 0;"><strong>The wrong attribute was:</strong> ${writer.convert_string_to_html_string(
                    wrongAttribute
                )}.</p>

            <p style="margin:0 0 8px 0;"><strong>Hint</strong></p>
            <p style="margin:0 0 16px 0; white-space:pre-wrap;">${writer.convert_string_to_html_string(
                    generalHint
                )}</p>

            <p style="margin:0 0 16px 0;">In case you feel not concentrated enough, make a short break.</p>

            <p style="margin:0;"><strong>Press [Enter]</strong> to go on.</p>
          </div>
        `;

                writer.print_html_on_stage(renderTwoColumn(queryHtml, feedbackHtml));
            };
        },
    };
};

BROWSER_EXPERIMENT(experiment_configuration_function);

/*
// experiment_configuration PRELIMINARY

import { BROWSER_EXPERIMENT } from "../../N-of-1-Experimentation/modules/Experimentation/Browser_Output_Writer.js";
import {
    Experiment_Output_Writer,
    keys,
    random_array_element,
    Reaction_Time,
    SET_SEED,
} from "../../N-of-1-Experimentation/modules/Experimentation/Experimentation.js";
import { Task } from "../../N-of-1-Experimentation/modules/Experimentation/Task.js";

import { result_array, ResultRow } from "./sqlGeneratorPrelimExp.js";

let SEED = "42";
SET_SEED(SEED);

const results: ResultRow[] = result_array;

let experiment_configuration_function = (writer: Experiment_Output_Writer) => {
    return {
        experiment_name: "CTE Formatting",
        seed: SEED,

        introduction_pages: [
            () => {
                writer.print_string_on_stage("Hello world.");
            }
        ],

        pre_run_training_instructions: writer.string_page_command(
            "You entered the training phase ABC."
        ),

        pre_run_experiment_instructions: writer.string_page_command(
            writer.convert_string_to_html_string("You entered the experiment phase ABC.")
        ),

        finish_pages: [
            writer.string_page_command(
                "<p>Almost done. Next, the experiment data will be downloaded (after pressing [Enter]).<br><br>" +
                "Please, send the downloaded file to the experimenter who will do the analysis</p>"
            ),
        ],

        layout: [
            { variable: "inlineSelect", treatments: ["true", "false"] },
        ],

        repetitions: 50,

        measurement: Reaction_Time(
            keys(["2","3","4"])),

        task_configuration: (t: Task) => {
            const current_selectInlineNewline = t.treatment_value("inlineSelect"); // "sql" | "pipe"

            const task: ResultRow = random_array_element(
                results.filter(
                    (entry) =>
                        JSON.stringify(entry.inlineSelect) === current_selectInlineNewline
                )
            );

            t.do_print_task = () => {
                writer.clear_stage();


                writer.print_html_on_stage(
                    "<h3>" +
                        writer.convert_string_to_html_string(
                            task.selectedAggregateSql
                        ) +
                    "</h3>" +
                    "<pre><code>" +
                    writer.convert_string_to_html_string(task.sqlQuery) +
                    "</code></pre>"
                );
            };

            t.expected_answer = task.selectedAggregateCteNumber.toString();

            t.do_print_after_task_information = () => {
                writer.print_html_on_stage(
                    "<h3>" +
                    writer.convert_string_to_html_string(
                        JSON.stringify(task.selectedAggregateCteNumber)
                    ) +
                    "</h3>"
                );

            };
        },
    };
};

BROWSER_EXPERIMENT(experiment_configuration_function);
*/
