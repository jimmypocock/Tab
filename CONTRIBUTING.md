# Contributing to Tab

First off, thank you for considering contributing to Tab! It's people like you that make Tab such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [Tab Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs if possible**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Setup

1. **Prerequisites**
   - Node.js 18+
   - npm or yarn
   - Docker (for local Supabase)
   - Stripe CLI (for webhook testing)

2. **Local Setup**
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/tab.git
   cd tab

   # Install dependencies
   npm install

   # Set up local environment
   npm run setup:local

   # Start development server
   npm run dev
   ```

3. **Environment Variables**
   Copy `.env.example` to `.env.local` and fill in the required values.

## Development Process

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes
- `chore/` - Maintenance tasks

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc)
- `refactor:` - Code refactoring
- `test:` - Test additions or fixes
- `chore:` - Maintenance tasks

Examples:
```
feat: add stripe checkout integration
fix: correct payment amount calculation
docs: update API documentation
```

### Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` before committing
- Follow the existing code style
- Use TypeScript for type safety
- Write meaningful variable and function names
- Add comments for complex logic

### Testing

- Write tests for new features
- Ensure all tests pass: `npm test`
- Aim for good test coverage
- Test edge cases
- Include integration tests for API endpoints

### Documentation

- Update README.md if needed
- Document new API endpoints in `/docs/API.md`
- Add JSDoc comments to functions
- Update CLAUDE.md for AI assistance context

## Project Structure

```
tab/
├── app/              # Next.js app directory
├── components/       # React components
├── lib/             # Utility functions and services
├── __tests__/       # Test files
├── docs/            # Documentation
└── supabase/        # Database migrations and config
```

## Key Areas

### API Development
- All API routes are in `/app/api/v1/`
- Use proper error handling with custom error classes
- Implement request validation with Zod
- Follow RESTful conventions

### Database
- Use Drizzle ORM for database operations
- Always consider Row Level Security (RLS)
- Write migrations for schema changes
- Test database operations thoroughly

### Security
- Never disable RLS on tables
- Validate all user inputs
- Use proper authentication middleware
- Handle sensitive data carefully
- Follow OWASP guidelines

## Review Process

1. All submissions require review before merging
2. The reviewer(s) will check:
   - Code quality and style
   - Test coverage
   - Documentation updates
   - Security implications
   - Performance impact

## Community

- Join our [Discord server](https://discord.gg/tab) (if applicable)
- Follow us on [Twitter](https://twitter.com/tab) (if applicable)
- Read our [blog](https://blog.tab.com) (if applicable)

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing! 🎉