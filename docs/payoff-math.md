# Payoff Math

## Assumptions

- No new purchases are added.
- APR remains constant per account.
- Interest compounds monthly using `apr / 12`.
- Minimum payments are paid first each month.

## Strategies

- **Avalanche:** allocate extra payment to highest APR account.
- **Snowball:** allocate extra payment to lowest balance account.

## Output

- Months to debt-free
- Total projected interest
- Month-by-month payment schedule per account
