#!/bin/bash

# Test Runner Script for Brand Infinity Engine
# Provides convenient test execution with proper environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for required environment
check_environment() {
    print_status "Checking test environment..."
    
    # Check if .env.test exists
    if [ ! -f .env.test ]; then
        print_warning ".env.test not found, using .env.local"
        if [ ! -f .env.local ]; then
            print_error "No environment file found. Please create .env.test or .env.local"
            exit 1
        fi
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "18" ]; then
        print_error "Node.js 18+ required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    
    print_success "Environment check completed"
}

# Setup test database
setup_test_db() {
    print_status "Setting up test database..."
    
    # Load environment variables
    if [ -f .env.test ]; then
        export $(cat .env.test | grep -v '^#' | xargs)
    elif [ -f .env.local ]; then
        export $(cat .env.local | grep -v '^#' | xargs)
    fi
    
    # Check Supabase connection
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        print_warning "Supabase credentials not found. Some tests may use mocks only."
    else
        print_success "Supabase connection configured"
    fi
}

# Run specific test suites
run_unit_tests() {
    print_status "Running unit tests..."
    npm run test:unit
}

run_integration_tests() {
    print_status "Running integration tests..."
    setup_test_db
    npm run test:integration
}

run_performance_tests() {
    print_status "Running performance tests..."
    setup_test_db
    print_warning "Performance tests may take several minutes to complete..."
    npm run test:performance
}

run_all_tests() {
    print_status "Running complete test suite..."
    setup_test_db
    npm run test:run
}

run_coverage_report() {
    print_status "Running tests with coverage report..."
    setup_test_db
    npm run test:coverage
    print_success "Coverage report generated in ./coverage/"
}

# Watch mode for development
run_watch_mode() {
    print_status "Starting test watcher..."
    setup_test_db
    npm run test:watch
}

# CI-specific test run
run_ci_tests() {
    print_status "Running CI test suite..."
    check_environment
    setup_test_db
    
    # Run secret scan first
    print_status "Running security scan..."
    npm run secret-scan
    
    # Run linting
    print_status "Running linting..."
    npm run lint
    
    # Run type checking
    print_status "Running type checking..."
    npx tsc -p tsconfig.json --noEmit
    
    # Run tests with coverage
    print_status "Running tests with coverage..."
    npm run test:ci
    
    print_success "CI test suite completed"
}

# Test specific files or patterns
run_specific_tests() {
    local pattern="$1"
    print_status "Running tests matching pattern: $pattern"
    setup_test_db
    npx vitest run "$pattern" --reporter=verbose
}

# Clean test artifacts
clean_test_artifacts() {
    print_status "Cleaning test artifacts..."
    
    # Remove coverage directory
    if [ -d "coverage" ]; then
        rm -rf coverage
        print_status "Removed coverage directory"
    fi
    
    # Remove test logs
    if [ -d "tests/logs" ]; then
        rm -rf tests/logs
        print_status "Removed test logs"
    fi
    
    # Remove any temporary test files
    find . -name "*.test.tmp" -delete 2>/dev/null || true
    find . -name "test-*.log" -delete 2>/dev/null || true
    
    print_success "Test artifacts cleaned"
}

# Display usage information
show_usage() {
    echo "Brand Infinity Engine Test Runner"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  unit         Run unit tests only"
    echo "  integration  Run integration tests only"
    echo "  performance  Run performance tests only"
    echo "  all          Run all tests (default)"
    echo "  coverage     Run tests with coverage report"
    echo "  watch        Run tests in watch mode"
    echo "  ci           Run complete CI test suite"
    echo "  clean        Clean test artifacts"
    echo "  pattern      Run tests matching specific pattern"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unit                    # Run unit tests"
    echo "  $0 integration             # Run integration tests"
    echo "  $0 pattern api/requests    # Run tests matching 'api/requests'"
    echo "  $0 coverage                # Generate coverage report"
    echo "  $0 ci                      # Run full CI suite"
    echo ""
    echo "Environment:"
    echo "  Place test configuration in .env.test or .env.local"
    echo "  Requires Node.js 18+ and npm dependencies installed"
}

# Main execution logic
main() {
    local command="${1:-all}"
    
    case "$command" in
        "unit")
            check_environment
            run_unit_tests
            ;;
        "integration")
            check_environment
            run_integration_tests
            ;;
        "performance")
            check_environment
            run_performance_tests
            ;;
        "all")
            check_environment
            run_all_tests
            ;;
        "coverage")
            check_environment
            run_coverage_report
            ;;
        "watch")
            check_environment
            run_watch_mode
            ;;
        "ci")
            run_ci_tests
            ;;
        "pattern")
            if [ -z "$2" ]; then
                print_error "Pattern argument required"
                show_usage
                exit 1
            fi
            check_environment
            run_specific_tests "$2"
            ;;
        "clean")
            clean_test_artifacts
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Handle script interruption
cleanup_on_exit() {
    print_status "Test runner interrupted. Cleaning up..."
    # Kill any background processes if needed
    # pkill -f "vitest" 2>/dev/null || true
    exit 130
}

trap cleanup_on_exit SIGINT SIGTERM

# Execute main function with all arguments
main "$@"