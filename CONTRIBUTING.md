# Contributing to Marketing Content Engine

Thank you for your interest in contributing to the Marketing Content Engine! This document provides guidelines and instructions for contributing.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Issues

- Check existing issues before creating a new one
- Provide detailed description of the problem
- Include steps to reproduce
- Specify your environment (OS, Python version, etc.)

### Suggesting Features

- Open an issue with the "feature request" label
- Clearly describe the proposed feature
- Explain the use case and benefits
- Consider implementation approach

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Update documentation
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## Development Setup

```bash
# Clone the repository
git clone https://github.com/nishchith-m1015/Marketing-Content-Engine.git
cd Marketing-Content-Engine

# Install dependencies
pip install -r requirements.txt

# Run tests
python test_engine.py
```

## Code Style

- Follow PEP 8 guidelines
- Use Black for code formatting: `black *.py`
- Use meaningful variable and function names
- Add docstrings to all classes and functions
- Keep functions focused and concise

## Testing

- Write tests for new features
- Ensure existing tests pass
- Aim for high test coverage
- Test edge cases and error conditions

```bash
# Run tests
python test_engine.py

# Run specific example
python example_basic.py
```

## Documentation

- Update README.md for user-facing changes
- Update API.md for API changes
- Update ARCHITECTURE.md for architectural changes
- Add docstrings to new code
- Include code examples

## Commit Messages

- Use clear and descriptive commit messages
- Start with a verb in present tense (Add, Fix, Update, etc.)
- Keep first line under 72 characters
- Add detailed description if needed

Examples:
```
Add viral score caching for performance
Fix brand compliance validation bug
Update documentation for new API methods
```

## Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add yourself to CONTRIBUTORS.md
4. Request review from maintainers
5. Address review feedback
6. Wait for approval and merge

## Areas for Contribution

### High Priority
- [ ] Real AI integration (OpenAI, Anthropic)
- [ ] Actual video synthesis with MoviePy
- [ ] Platform API integrations
- [ ] Web UI/Dashboard
- [ ] Performance optimization

### Medium Priority
- [ ] Additional platform support
- [ ] Advanced viral scoring algorithms
- [ ] Template library
- [ ] Scheduling system
- [ ] Analytics dashboard

### Low Priority
- [ ] Mobile app
- [ ] Plugin system
- [ ] Multi-language support
- [ ] Advanced reporting

## Architecture Guidelines

- Maintain separation between pillars
- Keep pillars stateless where possible
- Use dependency injection
- Follow SOLID principles
- Write testable code

## Questions?

Feel free to open an issue with the "question" label or reach out to maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
